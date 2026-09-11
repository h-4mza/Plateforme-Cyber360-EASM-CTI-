import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_get_members(client: AsyncClient, auth_headers):
    response = await client.get("/api/members", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["email"] == "admin@test.com"

@pytest.mark.asyncio
async def test_change_member_role(client: AsyncClient, auth_headers):
    # Register a new user in the same org
    # Wait, the auth register creates a NEW org for every user.
    # To have a member in the SAME org, we either accept an invitation or manipulate DB.
    # I'll create a user manually in the same org.
    from app.database import get_db
    from app.models.user import User, UserRole
    from app.models.organization import Organization
    from app.services.auth_service import get_password_hash
    from sqlalchemy import select
    from app.main import app

    user_id = None
    async for db in app.dependency_overrides[get_db]():
        admin = (await db.execute(select(User).where(User.email == "admin@test.com"))).scalar_one()
        new_user = User(
            email="member@test.com",
            hashed_password=get_password_hash("pass"),
            role=UserRole.readonly,
            organization_id=admin.organization_id
        )
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        user_id = new_user.id
    
    response = await client.put(f"/api/members/{user_id}/role", headers=auth_headers, json={"role": "admin"})
    assert response.status_code == 200
    assert response.json()["role"] == "admin"

@pytest.mark.asyncio
async def test_cannot_change_own_role(client: AsyncClient, auth_headers):
    # Find own id
    me_resp = await client.get("/api/auth/me", headers=auth_headers)
    my_id = me_resp.json()["id"]

    response = await client.put(f"/api/members/{my_id}/role", headers=auth_headers, json={"role": "readonly"})
    assert response.status_code == 400

@pytest.mark.asyncio
async def test_delete_member(client: AsyncClient, auth_headers):
    # Need a member to delete
    from app.database import get_db
    from app.models.user import User, UserRole
    from app.services.auth_service import get_password_hash
    from sqlalchemy import select
    from app.main import app

    user_id = None
    async for db in app.dependency_overrides[get_db]():
        admin = (await db.execute(select(User).where(User.email == "admin@test.com"))).scalar_one()
        new_user = User(
            email="delete_me@test.com",
            hashed_password=get_password_hash("pass"),
            role=UserRole.readonly,
            organization_id=admin.organization_id
        )
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        user_id = new_user.id

    response = await client.delete(f"/api/members/{user_id}", headers=auth_headers)
    assert response.status_code == 204

@pytest.mark.asyncio
async def test_cannot_delete_self(client: AsyncClient, auth_headers):
    me_resp = await client.get("/api/auth/me", headers=auth_headers)
    my_id = me_resp.json()["id"]

    response = await client.delete(f"/api/members/{my_id}", headers=auth_headers)
    assert response.status_code == 400
