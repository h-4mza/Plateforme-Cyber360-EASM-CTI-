import asyncio
import json
import yaml
import os
import sys

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import AsyncSessionLocal
from app.models.attack import AttackGroup, AttackTactic, AttackTechnique

def load_technique_mapping():
    mapping_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "app", "config", "technique_mapping.yaml")
    with open(mapping_path, "r") as f:
        return yaml.safe_load(f)

async def generate_drafts():
    # 1. Load detectable techniques
    mapping = load_technique_mapping()
    detectable_techniques = set()
    rule_key_by_technique = {}
    
    for rule_key, techniques in mapping.items():
        for t in techniques:
            detectable_techniques.add(t)
            if t not in rule_key_by_technique:
                rule_key_by_technique[t] = []
            rule_key_by_technique[t].append(rule_key)
            
    print(f"[+] Loaded {len(detectable_techniques)} detectable techniques from mapping.")
    
    # Preferred tactic order for a kill chain
    tactic_order = {
        "reconnaissance": 1,
        "resource-development": 2,
        "initial-access": 3,
        "execution": 4,
        "persistence": 5,
        "privilege-escalation": 6,
        "defense-evasion": 7,
        "credential-access": 8,
        "discovery": 9,
        "lateral-movement": 10,
        "collection": 11,
        "command-and-control": 12,
        "exfiltration": 13,
        "impact": 14
    }

    drafts = {}

    async with AsyncSessionLocal() as db:
        # Load all groups with techniques and their tactics
        stmt = select(AttackGroup).options(
            selectinload(AttackGroup.techniques).selectinload(AttackTechnique.tactics)
        )
        groups = (await db.execute(stmt)).scalars().all()
        
        for group in groups:
            # Filter techniques that we can actually detect
            group_detectable_techs = [t for t in group.techniques if t.id in detectable_techniques]
            
            if not group_detectable_techs:
                continue
                
            # Sort techniques into a kill chain based on tactics
            chain_stages = {}
            for t in group_detectable_techs:
                for tactic in t.tactics:
                    order = tactic_order.get(tactic.short_name, 99)
                    if order not in chain_stages:
                        chain_stages[order] = []
                    chain_stages[order].append(t)
            
            # If the group has detectable techniques spanning at least 2 distinct tactic phases
            if len(chain_stages) >= 2:
                sorted_orders = sorted(chain_stages.keys())
                
                kill_chain = []
                stage_idx = 1
                
                for order in sorted_orders:
                    techs_for_stage = chain_stages[order]
                    # We just take all rules that can detect any of these techniques
                    stage_rules = set()
                    stage_tech_ids = set()
                    
                    for t in techs_for_stage:
                        stage_tech_ids.add(t.id)
                        for rk in rule_key_by_technique.get(t.id, []):
                            stage_rules.add(rk)
                            
                    kill_chain.append({
                        "stage": stage_idx,
                        "name": techs_for_stage[0].tactics[0].name if techs_for_stage[0].tactics else f"Phase {order}",
                        "description": f"Détection de l'étape {stage_idx} par les règles associées aux TTP du groupe {group.name}.",
                        "rule_keys": list(stage_rules),
                        "require_same_asset": False,
                        "max_hops": 2 if stage_idx > 1 else 0
                    })
                    stage_idx += 1
                
                scenario_id = f"scenario_draft_{group.name.lower().replace(' ', '_')}"
                drafts[scenario_id] = {
                    "title": f"[{group.name}] Kill Chain potentielle",
                    "severity": "critical",
                    "explanation": f"Ce scénario a été auto-généré car les techniques utilisées par le groupe {group.name} correspondent à plusieurs de nos règles de détection (rule_keys).",
                    "kill_chain": kill_chain
                }

    output_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "attack_scenarios_drafts.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(drafts, f, indent=4, ensure_ascii=False)
        
    print(f"[+] Successfully generated {len(drafts)} drafts into {output_path}")

if __name__ == "__main__":
    asyncio.run(generate_drafts())
