from pydantic import BaseModel

class MitreTechniqueResponse(BaseModel):
    technique_id: str
    name: str
    risks_count: int
