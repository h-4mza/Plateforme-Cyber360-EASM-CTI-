from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import uuid
import secrets
import dns.resolver
from app.database import get_db
from app.models.user import User, UserRole
from app.models.domain import Domain, DomainStatus
from app.schemas.domain import DomainCreate, DomainResponse
from app.dependencies import require_role
from app.modules.discovery.tasks import discover_domain

router = APIRouter()

@router.post("", response_model=DomainResponse)
async def add_domain(
    domain_data: DomainCreate,
    current_user: User = Depends(require_role(UserRole.analyst)),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Domain).where(Domain.name == domain_data.name, Domain.organization_id == current_user.organization_id)
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Domain already exists in your organization")
        
    token = f"cyber360-verify={secrets.token_urlsafe(16)}"
    
    domain = Domain(
        name=domain_data.name.lower(),
        organization_id=current_user.organization_id,
        added_by_id=current_user.id,
        status=DomainStatus.pending,
        verification_token=token if getattr(domain_data, 'relationship', 'own') == 'own' else None,
        relationship=getattr(domain_data, 'relationship', 'own')
    )
    db.add(domain)
    await db.commit()
    await db.refresh(domain)
    
    # Dispatch discovery task
    discover_domain.delay(str(domain.id))
    
    return domain

@router.post("/{domain_id}/verify")
async def verify_domain(
    domain_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Domain).where(Domain.id == domain_id, Domain.organization_id == current_user.organization_id)
    result = await db.execute(stmt)
    domain = result.scalar_one_or_none()
    
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
        
    if getattr(domain, 'relationship', 'own') == "vendor":
        raise HTTPException(status_code=400, detail="Cannot verify vendor domains. Monitoring is passive only.")
        
    if domain.ownership_verified:
        return {"status": "ok", "message": "Domain is already verified"}
        
    try:
        answers = dns.resolver.resolve(domain.name, 'TXT')
        for rdata in answers:
            txt_record = rdata.to_text().strip('"')
            if txt_record == domain.verification_token:
                domain.ownership_verified = True
                from datetime import datetime, timezone
                domain.verified_at = datetime.now(timezone.utc)
                await db.commit()
                
                from app.modules.discovery.tasks import run_active_recon
                run_active_recon.delay(str(domain.id))
                
                return {"status": "ok", "message": "Domain successfully verified"}
    except Exception:
        pass
        
    raise HTTPException(status_code=400, detail="Verification token not found in DNS TXT records. Please ensure you have added the TXT record and wait for DNS propagation.")

@router.get("", response_model=List[DomainResponse])
async def list_domains(
    current_user: User = Depends(require_role(UserRole.readonly)),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Domain).where(Domain.organization_id == current_user.organization_id)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/{id}", response_model=DomainResponse)
async def get_domain(
    id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.readonly)),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Domain).where(Domain.id == id, Domain.organization_id == current_user.organization_id)
    result = await db.execute(stmt)
    domain = result.scalar_one_or_none()
    
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
        
    return domain

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_domain(
    id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Domain).where(Domain.id == id, Domain.organization_id == current_user.organization_id)
    result = await db.execute(stmt)
    domain = result.scalar_one_or_none()
    
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
        
    from app.models.threat_intel import ThreatIntelFinding
    from sqlalchemy import delete
    
    stmt1 = delete(ThreatIntelFinding).where(
        ThreatIntelFinding.organization_id == current_user.organization_id,
        ThreatIntelFinding.raw_data['domain'].astext == domain.name
    )
    await db.execute(stmt1)
    
    stmt2 = delete(ThreatIntelFinding).where(
        ThreatIntelFinding.organization_id == current_user.organization_id,
        ThreatIntelFinding.raw_data['original_domain'].astext == domain.name
    )
    await db.execute(stmt2)

    await db.delete(domain)
    await db.commit()
    return None

from app.models.asset import Asset
from app.schemas.asset import AssetResponse

@router.get("/{id}/assets", response_model=List[AssetResponse])
async def list_domain_assets(
    id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.readonly)),
    db: AsyncSession = Depends(get_db)
):
    # Check if domain exists
    stmt = select(Domain).where(Domain.id == id, Domain.organization_id == current_user.organization_id)
    result = await db.execute(stmt)
    domain = result.scalar_one_or_none()
    
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
        
    # Get assets
    asset_stmt = select(Asset).where(Asset.domain_id == id).order_by(Asset.type, Asset.hostname, Asset.ip_address)
    asset_result = await db.execute(asset_stmt)
    return asset_result.scalars().all()

@router.post("/{id}/active-recon")
async def trigger_active_recon(
    id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Domain).where(Domain.id == id, Domain.organization_id == current_user.organization_id)
    result = await db.execute(stmt)
    domain = result.scalar_one_or_none()
    
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
        
    if getattr(domain, 'relationship', 'own') == "vendor":
        raise HTTPException(status_code=400, detail="Cannot run active recon on vendor domains. Monitoring is passive only.")
        
    if not domain.ownership_verified:
        raise HTTPException(status_code=400, detail="Domain must be verified first")
        
    from app.modules.discovery.tasks import run_active_recon
    run_active_recon.delay(str(domain.id))
    
    return {"status": "ok", "message": "Active recon dispatched"}
