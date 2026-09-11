import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_create_invitation(client: AsyncClient, auth_headers):
    response = await client.post("/api/invitations", headers=auth_headers, json={
        "email": "invite@test.com",
        "role": "readonly"
    })
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "invite@test.com"
    assert "token" in data

@pytest.mark.asyncio
async def test_list_invitations(client: AsyncClient, auth_headers):
    await client.post("/api/invitations", headers=auth_headers, json={
        "email": "list1@test.com",
        "role": "readonly"
    })
    response = await client.get("/api/invitations", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert any(inv["email"] == "list1@test.com" for inv in data)

@pytest.mark.asyncio
async def test_accept_invitation(client: AsyncClient, auth_headers):
    inv_resp = await client.post("/api/invitations", headers=auth_headers, json={
        "email": "accept@test.com",
        "role": "readonly"
    })
    token = inv_resp.json()["token"]

    response = await client.post(f"/api/invitations/accept/{token}", json={
        "password": "NewUserPass123!",
        "full_name": "Accepted User"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "accept@test.com"
    assert data["role"] == "readonly"

@pytest.mark.asyncio
async def test_cancel_invitation(client: AsyncClient, auth_headers):
    inv_resp = await client.post("/api/invitations", headers=auth_headers, json={
        "email": "cancel@test.com",
        "role": "readonly"
    })
    inv_id = inv_resp.json()["id"]

    response = await client.delete(f"/api/invitations/{inv_id}", headers=auth_headers)
    assert response.status_code == 204

    # Verify it is cancelled
    list_resp = await client.get("/api/invitations", headers=auth_headers)
    assert not any(inv["id"] == inv_id for inv in list_resp.json())
