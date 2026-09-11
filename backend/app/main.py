from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.api import auth, organizations, members, invitations, domains, assets, risks, compliance, mitre, scenarios, benchmarks
from app.modules.threat_intel import check_threat_intel_keys
from app.database import engine
from app.models.base import Base

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Setup database
    # In production, migrations should be handled outside the app startup
    import os
    if os.environ.get("ENV") != "production":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            
    # Check Threat Intel keys
    check_threat_intel_keys()
            
    yield
    # Cleanup
    await engine.dispose()

app = FastAPI(title="Cyber360 API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(organizations.router, prefix="/api/organizations", tags=["Organizations"])
app.include_router(members.router, prefix="/api/organizations/me/members", tags=["Members"])
app.include_router(invitations.router, prefix="/api/invitations", tags=["Invitations"])
app.include_router(domains.router, prefix="/api/domains", tags=["Domains"])
app.include_router(assets.router, prefix="/api/assets", tags=["Assets"])
app.include_router(risks.router, prefix="/api", tags=["Risks"])
app.include_router(compliance.router, prefix="/api", tags=["Compliance"])
app.include_router(mitre.router, prefix="/api", tags=["MITRE ATT&CK"])
from app.api import attack
app.include_router(attack.router, prefix="/api/attack", tags=["MITRE ATT&CK Sync"])
app.include_router(scenarios.router, prefix="/api", tags=["Attack Scenarios"])
app.include_router(benchmarks.router, prefix="/api", tags=["Benchmarks"])

from app.api import brand_protection
app.include_router(brand_protection.router, prefix="/api/brand-protection", tags=["Brand Protection"])

from app.api import threat_landscape
app.include_router(threat_landscape.router, prefix="/api", tags=["Threat Landscape"])

@app.get("/health")
async def health_check():
    return {"status": "ok"}
