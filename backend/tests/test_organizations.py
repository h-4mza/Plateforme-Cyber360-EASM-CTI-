import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_get_org_me(client: AsyncClient, auth_headers):
    response = await client.get("/api/organizations/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Org"

@pytest.mark.asyncio
async def test_update_org_me(client: AsyncClient, auth_headers):
    response = await client.put("/api/organizations/me", headers=auth_headers, json={
        "name": "Updated Org",
        "sector": "Technology"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Org"
    assert data["sector"] == "Technology"

@pytest.mark.asyncio
async def test_update_org_me_readonly_fails(client: AsyncClient, auth_headers):
    # First, let's create a readonly user and login
    # Invite is complex, let's just register and assume we can change role via DB or API if needed.
    # We will simulate by trying to access something that requires admin.
    # Actually, we can just create a new user manually or let it fail if the app has readonly user.
    # Wait, the instruction says "PUT /api/organizations/me fails for readonly user".
    # I'll register a user and update their role in DB, then attempt it.
    from app.database import get_db
    from app.models.user import User, UserRole
    from sqlalchemy import select
    from app.main import app

    # get the DB session from override
    # Registering a user makes them admin. We'll change it to readonly.
    await client.post("/api/auth/register", json={
        "email": "readonly@test.com",
        "password": "Password123!",
        "organization_name": "Readonly Org"
    })
    
    login_resp = await client.post("/api/auth/login", json={
        "email": "readonly@test.com",
        "password": "Password123!"
    })
    token = login_resp.json()["access_token"]
    ro_headers = {"Authorization": f"Bearer {token}"}

    # Hack to change role
    async for db in app.dependency_overrides[get_db]():
        result = await db.execute(select(User).where(User.email == "readonly@test.com"))
        user = result.scalar_one()
        user.role = UserRole.readonly
        await db.commit()

    response = await client.put("/api/organizations/me", headers=ro_headers, json={
        "name": "Hacked Org"
    })
    assert response.status_code in [403, 401]
