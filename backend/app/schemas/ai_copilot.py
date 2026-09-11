from pydantic import BaseModel, Field
from typing import List
from datetime import datetime
import uuid

class CopilotAnalysis(BaseModel):
    explanation: str = Field(..., description="Explication claire du risque pour un technicien.")
    business_impact: str = Field(..., description="Impact métier de la vulnérabilité (vol de données, etc.).")
    remediation_steps: List[str] = Field(..., description="Étapes techniques précises pour corriger la faille.")
    suggested_mitre_techniques: List[str] = Field(..., description="Liste d'IDs de techniques MITRE ATT&CK (ex: T1566) pertinentes.")
    confidence: float = Field(..., description="Niveau de confiance de l'analyse IA (de 0.0 à 1.0).")

class RiskAICopilotResponse(BaseModel):
    id: uuid.UUID | None = None
    risk_id: uuid.UUID
    status: str = Field(default="success", description="Status of the analysis: success, failed, or in_progress")
    error: str | None = None
    payload: CopilotAnalysis | None = None
    generated_at: datetime | None = None
    model_used: str | None = None
    validated_by_user: bool = False

    model_config = {"from_attributes": True}

class AssetCopilotAnalysis(BaseModel):
    summary: str = Field(..., description="Résumé du rôle probable de cet actif dans l'infrastructure.")
    exposure_level: str = Field(..., description="Niveau d'exposition au risque (ex: Critique, Élevé, Modéré).")
    security_anomalies: List[str] = Field(..., description="Liste des anomalies ou risques structurels déduits (ex: 'Base de données exposée', 'Certificat expiré').")
    hardening_recommendations: List[str] = Field(..., description="Recommandations stratégiques pour durcir cet actif.")
    confidence: float = Field(..., description="Niveau de confiance de l'analyse (0.0 à 1.0).")

class AssetAICopilotResponse(BaseModel):
    id: uuid.UUID | None = None
    asset_id: uuid.UUID
    status: str = Field(default="success")
    error: str | None = None
    payload: AssetCopilotAnalysis | None = None
    generated_at: datetime | None = None
    model_used: str | None = None

    model_config = {"from_attributes": True}

class ValidateTechniqueRequest(BaseModel):
    technique_id: str
