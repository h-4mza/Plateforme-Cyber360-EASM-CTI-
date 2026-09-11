from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from datetime import datetime, timedelta
import uuid
from app.database import get_db
from app.models.user import User, UserRole
from app.models.invitation import Invitation, InvitationStatus
from app.schemas.invitation import InvitationCreate, InvitationResponse, InvitationAccept
from app.schemas.user import UserResponse
from app.dependencies import require_role
from app.services.invitation_service import generate_invitation_token, send_invitation_email
from app.services.auth_service import get_password_hash

router = APIRouter()

@router.post("", response_model=InvitationResponse)
async def create_invitation(
    invite_data: InvitationCreate,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db)
):
    token = await generate_invitation_token()
    expires_at = datetime.utcnow() + timedelta(hours=48)
    
    invitation = Invitation(
        email=invite_data.email,
        role=invite_data.role,
        organization_id=current_user.organization_id,
        invited_by_id=current_user.id,
        token=token,
        expires_at=expires_at
    )
    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)
    
    await send_invitation_email(invitation.email, invitation.token)
    
    return invitation

@router.get("", response_model=List[InvitationResponse])
async def list_invitations(
    current_user: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Invitation).where(Invitation.organization_id == current_user.organization_id)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/{token}/accept", response_model=UserResponse)
async def accept_invitation(
    token: str,
    accept_data: InvitationAccept,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Invitation).where(Invitation.token == token, Invitation.status == InvitationStatus.pending)
    result = await db.execute(stmt)
    invitation = result.scalar_one_or_none()
    
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found or already processed")
        
    if invitation.expires_at.replace(tzinfo=None) < datetime.utcnow():
        invitation.status = InvitationStatus.expired
        await db.commit()
        raise HTTPException(status_code=400, detail="Invitation expired")
        
    user = User(
        email=invitation.email,
        hashed_password=get_password_hash(accept_data.password),
        full_name=accept_data.full_name,
        role=invitation.role,
        organization_id=invitation.organization_id
    )
    db.add(user)
    
    invitation.status = InvitationStatus.accepted
    await db.commit()
    await db.refresh(user)
    
    return user

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_invitation(
    id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Invitation).where(Invitation.id == id, Invitation.organization_id == current_user.organization_id)
    result = await db.execute(stmt)
    invitation = result.scalar_one_or_none()
    
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")
        
    await db.delete(invitation)
    await db.commit()
