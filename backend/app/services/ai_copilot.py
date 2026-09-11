import asyncio
import json
import uuid
import time
import os
import logging
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import ValidationError

from app.models.risk import Risk
from app.models.ai_copilot import RiskAICopilotResult, AILog
from app.schemas.ai_copilot import CopilotAnalysis
from app.api.mitre import load_risk_rules
from app.core.llm_client import call_llm
from app.core.llm_prompts import COPILOT_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

async def analyze_risk_with_ai(risk_id: uuid.UUID, db: AsyncSession):
    start_time = time.time()
    
    # 1. Fetch Risk and Context
    stmt = select(Risk).options(selectinload(Risk.asset), selectinload(Risk.techniques)).where(Risk.id == risk_id)
    risk = await db.scalar(stmt)
    if not risk:
        raise ValueError("Risk not found")
        
    rules = load_risk_rules()
    rule_info = rules.get(risk.rule_key, {})
    
    # Construction du prompt utilisateur
    user_prompt = f"""Analyse cette vulnérabilité :
- Règle déclenchée : {risk.rule_key}
- Titre : {rule_info.get("title", "N/A")}
- Sévérité : {risk.severity}
- Actif ciblé : {risk.asset.hostname or risk.asset.ip_address if risk.asset else 'Inconnu'}
- Détails techniques (JSON) : {json.dumps(risk.details) if risk.details else 'Aucun'}
- Explication générique existante : {rule_info.get("explanation", "N/A")}"""

    error_msg = None
    analysis = None
    model_used = "unknown"
    llm_response = None
    
    try:
        llm_response = await call_llm(system_prompt=COPILOT_SYSTEM_PROMPT, user_prompt=user_prompt)
        model_used = llm_response["model"]
        raw_text = llm_response["text"]
        
        # Nettoyage robuste (retirer les blocs markdown si le LLM n'a pas respecté la consigne)
        clean_text = raw_text.strip()
        if clean_text.startswith("```json"):
            clean_text = clean_text[7:]
        elif clean_text.startswith("```"):
            clean_text = clean_text[3:]
        if clean_text.endswith("```"):
            clean_text = clean_text[:-3]
        clean_text = clean_text.strip()
            
        try:
            parsed_json = json.loads(clean_text)
        except json.JSONDecodeError as je:
            raise ValueError(f"Le LLM a retourné un JSON malformé : {je}")
            
        try:
            analysis = CopilotAnalysis(**parsed_json)
        except ValidationError as ve:
            raise ValueError(f"Le JSON du LLM ne respecte pas le schéma Pydantic : {ve}")
            
    except Exception as e:
        logger.error(f"Échec de l'analyse IA pour le risque {risk_id} : {e}")
        error_msg = str(e)
        
    latency_ms = int((time.time() - start_time) * 1000)
    
    # Log usage systematically
    log_entry = AILog(
        endpoint="analyze_risk",
        model=model_used,
        latency_ms=latency_ms,
        prompt_tokens=llm_response.get("prompt_tokens") if llm_response else 0,
        completion_tokens=llm_response.get("completion_tokens") if llm_response else 0,
        cost_usd=0.0 # Approximation ou à calculer
    )
    db.add(log_entry)
    
    if error_msg:
        return {"status": "failed", "error": error_msg}
        
    return {"status": "success", "payload": analysis, "model": model_used}

from app.models.asset import Asset
from app.schemas.ai_copilot import AssetCopilotAnalysis
from app.core.llm_prompts import ASSET_COPILOT_SYSTEM_PROMPT

async def analyze_asset_with_ai(asset_id: uuid.UUID, db: AsyncSession):
    start_time = time.time()
    
    stmt = select(Asset).options(selectinload(Asset.risks)).where(Asset.id == asset_id)
    asset = await db.scalar(stmt)
    if not asset:
        raise ValueError("Asset not found")
        
    risks_summary = [{"rule": r.rule_key, "severity": r.severity} for r in asset.risks if r.status == 'open']
    
    user_prompt = f"""Analyse cet Actif :
- Hostname : {asset.hostname or 'N/A'}
- IP : {asset.ip_address or 'N/A'}
- Type : {asset.type}
- Technologie détectée : {asset.technology or 'Inconnue'}
- Criticité définie : {asset.criticality}
- EOL (Fin de vie) : {asset.is_eol}
- Certificat (Sujet) : {asset.cert_subject or 'N/A'}
- Risques ouverts : {json.dumps(risks_summary)}"""

    error_msg = None
    analysis = None
    model_used = "unknown"
    llm_response = None
    
    try:
        llm_response = await call_llm(system_prompt=ASSET_COPILOT_SYSTEM_PROMPT, user_prompt=user_prompt)
        model_used = llm_response["model"]
        raw_text = llm_response["text"]
        
        clean_text = raw_text.strip()
        if clean_text.startswith("```json"): clean_text = clean_text[7:]
        elif clean_text.startswith("```"): clean_text = clean_text[3:]
        if clean_text.endswith("```"): clean_text = clean_text[:-3]
        clean_text = clean_text.strip()
            
        try:
            parsed_json = json.loads(clean_text)
        except json.JSONDecodeError as je:
            raise ValueError(f"JSON malformé : {je}")
            
        try:
            analysis = AssetCopilotAnalysis(**parsed_json)
        except ValidationError as ve:
            raise ValueError(f"Schéma Pydantic invalide : {ve}")
            
    except Exception as e:
        logger.error(f"Échec analyse IA pour actif {asset_id} : {e}")
        error_msg = str(e)
        
    latency_ms = int((time.time() - start_time) * 1000)
    
    log_entry = AILog(
        endpoint="analyze_asset",
        model=model_used,
        latency_ms=latency_ms,
        prompt_tokens=llm_response.get("prompt_tokens") if llm_response else 0,
        completion_tokens=llm_response.get("completion_tokens") if llm_response else 0,
        cost_usd=0.0
    )
    db.add(log_entry)
    
    if error_msg:
        return {"status": "failed", "error": error_msg}
        
    return {"status": "success", "payload": analysis, "model": model_used}
