import asyncio
import hashlib
import json
import logging
import os
from typing import Dict, List, Set, Tuple

import httpx
from stix2 import MemoryStore, Filter
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type

from sqlalchemy import select, delete
from sqlalchemy.dialects.postgresql import insert
from app.database import AsyncSessionLocal
from app.models.attack import (
    AttackTactic, AttackTechnique, AttackGroup, AttackSoftware, AttackMitigation,
    AttackSoftwareType, attack_technique_tactics, attack_group_techniques,
    attack_software_techniques, attack_software_groups, attack_technique_mitigations
)

logger = logging.getLogger(__name__)

STIX_URL = "https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json"
CACHE_FILE = "/tmp/enterprise-attack-cache.json"
HASH_FILE = "/tmp/enterprise-attack-hash.txt"

@retry(
    wait=wait_exponential(multiplier=1, min=4, max=10),
    stop=stop_after_attempt(3),
    retry=retry_if_exception_type(httpx.RequestError)
)
async def fetch_bundle() -> tuple[bool, dict]:
    async with httpx.AsyncClient() as client:
        response = await client.get(STIX_URL, timeout=30.0)
        response.raise_for_status()
        content = response.content
        
        current_hash = hashlib.sha256(content).hexdigest()
        
        try:
            if os.path.exists(HASH_FILE):
                with open(HASH_FILE, "r") as f:
                    saved_hash = f.read().strip()
                if saved_hash == current_hash and os.path.exists(CACHE_FILE):
                    logger.info("MITRE ATT&CK bundle has not changed.")
                    with open(CACHE_FILE, "r", encoding="utf-8") as f:
                        return False, json.load(f)
        except Exception as e:
            logger.warning(f"Failed to read cache: {e}")
            
        bundle_data = json.loads(content)
        try:
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(bundle_data, f)
            with open(HASH_FILE, "w") as f:
                f.write(current_hash)
        except Exception as e:
            logger.warning(f"Failed to write cache: {e}")
            
        return True, bundle_data

def get_external_id(stix_obj) -> str:
    if "external_references" in stix_obj:
        for ref in stix_obj["external_references"]:
            if ref.get("source_name") == "mitre-attack":
                return ref.get("external_id")
    return stix_obj["id"]

async def sync_mitre_attack_data():
    logger.info("Starting MITRE ATT&CK sync...")
    changed, bundle_data = await fetch_bundle()
    
    logger.info("Loading bundle into stix2 MemoryStore...")
    store = MemoryStore(stix_data=bundle_data["objects"])
    
    tactics = store.query([Filter('type', '=', 'x-mitre-tactic')])
    techniques = store.query([Filter('type', '=', 'attack-pattern')])
    groups = store.query([Filter('type', '=', 'intrusion-set')])
    malwares = store.query([Filter('type', '=', 'malware')])
    tools = store.query([Filter('type', '=', 'tool')])
    mitigations = store.query([Filter('type', '=', 'course-of-action')])
    relationships = store.query([Filter('type', '=', 'relationship')])
    
    id_map = {}
    for obj in tactics + techniques + groups + malwares + tools + mitigations:
        id_map[obj["id"]] = get_external_id(obj)

    tactic_records = []
    for t in tactics:
        tactic_records.append({
            "id": id_map[t["id"]],
            "name": t.get("name"),
            "short_name": t.get("x_mitre_shortname", ""),
            "description": t.get("description"),
            "order": 0
        })
        
    technique_records = []
    for t in techniques:
        technique_records.append({
            "id": id_map[t["id"]],
            "name": t.get("name"),
            "description": t.get("description"),
            "is_subtechnique": t.get("x_mitre_is_subtechnique", False),
            "parent_technique_id": None,
            "platforms": t.get("x_mitre_platforms", []),
            "data_sources": t.get("x_mitre_data_sources", []),
            "version": t.get("x_mitre_version"),
            "created": t.get("created"),
            "modified": t.get("modified")
        })
        
    group_records = []
    for g in groups:
        group_records.append({
            "id": id_map[g["id"]],
            "name": g.get("name"),
            "aliases": g.get("aliases", []),
            "description": g.get("description")
        })
        
    software_records = []
    for s in malwares:
        software_records.append({
            "id": id_map[s["id"]],
            "name": s.get("name"),
            "type": AttackSoftwareType.malware,
            "description": s.get("description")
        })
    for s in tools:
        software_records.append({
            "id": id_map[s["id"]],
            "name": s.get("name"),
            "type": AttackSoftwareType.tool,
            "description": s.get("description")
        })
        
    mitigation_records = []
    for m in mitigations:
        mitigation_records.append({
            "id": id_map[m["id"]],
            "name": m.get("name"),
            "description": m.get("description")
        })

    tech_tactics_links = set()
    group_tech_links = set()
    soft_tech_links = set()
    soft_group_links = set()
    tech_mit_links = set()
    
    for r in relationships:
        source_id = id_map.get(r["source_ref"])
        target_id = id_map.get(r["target_ref"])
        if not source_id or not target_id:
            continue
            
        rel_type = r["relationship_type"]
        if rel_type == "subtechnique-of":
            for tr in technique_records:
                if tr["id"] == source_id:
                    tr["parent_technique_id"] = target_id
                    
        elif rel_type == "uses":
            source_obj = store.get(r["source_ref"])
            target_obj = store.get(r["target_ref"])
            if not source_obj or not target_obj:
                continue
                
            if source_obj["type"] == "intrusion-set" and target_obj["type"] == "attack-pattern":
                group_tech_links.add((source_id, target_id))
            elif source_obj["type"] in ("malware", "tool") and target_obj["type"] == "attack-pattern":
                soft_tech_links.add((source_id, target_id))
            elif source_obj["type"] == "intrusion-set" and target_obj["type"] in ("malware", "tool"):
                soft_group_links.add((target_id, source_id))
                
        elif rel_type == "mitigates":
            source_obj = store.get(r["source_ref"])
            target_obj = store.get(r["target_ref"])
            if source_obj and target_obj and source_obj["type"] == "course-of-action" and target_obj["type"] == "attack-pattern":
                tech_mit_links.add((source_id, target_id))
                
    for t in techniques:
        tech_id = id_map[t["id"]]
        kill_chain_phases = t.get("kill_chain_phases", [])
        for phase in kill_chain_phases:
            if phase["kill_chain_name"] == "mitre-attack":
                phase_name = phase["phase_name"]
                for tac in tactic_records:
                    if tac["short_name"] == phase_name:
                        tech_tactics_links.add((tech_id, tac["id"]))

    async with AsyncSessionLocal() as db:
        async def do_upsert(model, records, conflict_cols):
            if not records:
                return
            stmt = insert(model).values(records)
            update_dict = {c.name: c for c in stmt.excluded if c.name not in conflict_cols}
            if update_dict:
                stmt = stmt.on_conflict_do_update(
                    index_elements=conflict_cols,
                    set_=update_dict
                )
            else:
                stmt = stmt.on_conflict_do_nothing(index_elements=conflict_cols)
            await db.execute(stmt)

        logger.info("Upserting base models...")
        await do_upsert(AttackTactic, tactic_records, ["id"])
        await do_upsert(AttackTechnique, technique_records, ["id"])
        await do_upsert(AttackGroup, group_records, ["id"])
        await do_upsert(AttackSoftware, software_records, ["id"])
        await do_upsert(AttackMitigation, mitigation_records, ["id"])
        
        logger.info("Upserting relationship tables...")
        await db.execute(delete(attack_technique_tactics))
        if tech_tactics_links:
            await db.execute(insert(attack_technique_tactics).values([{"technique_id": t, "tactic_id": tac} for t, tac in tech_tactics_links]))
            
        await db.execute(delete(attack_group_techniques))
        if group_tech_links:
            await db.execute(insert(attack_group_techniques).values([{"group_id": g, "technique_id": t} for g, t in group_tech_links]))
            
        await db.execute(delete(attack_software_techniques))
        if soft_tech_links:
            await db.execute(insert(attack_software_techniques).values([{"software_id": s, "technique_id": t} for s, t in soft_tech_links]))
            
        await db.execute(delete(attack_software_groups))
        if soft_group_links:
            await db.execute(insert(attack_software_groups).values([{"software_id": s, "group_id": g} for s, g in soft_group_links]))
            
        await db.execute(delete(attack_technique_mitigations))
        if tech_mit_links:
            await db.execute(insert(attack_technique_mitigations).values([{"mitigation_id": m, "technique_id": t} for m, t in tech_mit_links]))
            
        await db.commit()
        
    logger.info(f"MITRE ATT&CK sync complete. Tactiques: {len(tactic_records)}, "
                f"Techniques: {len(technique_records)}, Groupes: {len(group_records)}, "
                f"Software: {len(software_records)}, Mitigations: {len(mitigation_records)}")
