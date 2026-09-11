from pydantic import BaseModel

class SectorBenchmarkResponse(BaseModel):
    sector: str
    metric_type: str
    percentile_25: float
    percentile_50: float
    percentile_75: float
    sample_size: int

class OrgBenchmarkResponse(BaseModel):
    is_available: bool
    sector: str | None = None
    org_score: float | None = None
    percentile_25: float | None = None
    percentile_50: float | None = None
    percentile_75: float | None = None
    position_text: str | None = None
