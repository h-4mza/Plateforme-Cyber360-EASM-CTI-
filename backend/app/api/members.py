from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import uuid
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserResponse, UserUpdateRole
from app.dependencies import get_current_user, require_role

router = APIRouter()

@router.get("", response_model=List[UserResponse])
async def list_members(current_user: User = Depends(require_role(UserRole.readonly)), db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.organization_id == current_user.organization_id)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.put("/{user_id}/role", response_model=UserResponse)
async def update_member_role(
    user_id: uuid.UUID,
    role_data: UserUpdateRole,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")
        
    stmt = select(User).where(User.id == user_id, User.organization_id == current_user.organization_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.role = role_data.role
    await db.commit()
    await db.refresh(user)
    return user

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    user_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")
        
    stmt = select(User).where(User.id == user_id, User.organization_id == current_user.organization_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    await db.delete(user)
    await db.commit()
