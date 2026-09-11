import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    response = await client.post("/api/auth/register", json={
        "email": "newuser@test.com",
        "password": "Password123!",
        "organization_name": "New Org",
        "full_name": "New User"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "newuser@test.com"
    assert data["organization_id"] is not None

@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient, auth_headers):
    # admin@test.com is already registered by auth_headers fixture
    response = await client.post("/api/auth/register", json={
        "email": "admin@test.com",
        "password": "Password123!",
        "organization_name": "Dupe Org"
    })
    assert response.status_code == 400
    assert "already registered" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, auth_headers):
    response = await client.post("/api/auth/login", json={
        "email": "admin@test.com",
        "password": "TestPass123!"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data

@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, auth_headers):
    response = await client.post("/api/auth/login", json={
        "email": "admin@test.com",
        "password": "WrongPassword!"
    })
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_get_me_success(client: AsyncClient, auth_headers):
    response = await client.get("/api/auth/me", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["email"] == "admin@test.com"

@pytest.mark.asyncio
async def test_get_me_unauthorized(client: AsyncClient):
    response = await client.get("/api/auth/me")
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_refresh_token_success(client: AsyncClient, auth_headers):
    login_response = await client.post("/api/auth/login", json={
        "email": "admin@test.com",
        "password": "TestPass123!"
    })
    refresh_token = login_response.json()["refresh_token"]

    response = await client.post("/api/auth/refresh", json={
        "refresh_token": refresh_token
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data

@pytest.mark.asyncio
async def test_refresh_invalid_token(client: AsyncClient):
    response = await client.post("/api/auth/refresh", json={
        "refresh_token": "invalid_token_string"
    })
    assert response.status_code == 401
