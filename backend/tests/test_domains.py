import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_create_domain(client: AsyncClient, auth_headers):
    response = await client.post("/api/domains", headers=auth_headers, json={
        "name": "example.com"
    })
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "example.com"

@pytest.mark.asyncio
async def test_list_domains(client: AsyncClient, auth_headers):
    await client.post("/api/domains", headers=auth_headers, json={
        "name": "list1.com"
    })
    await client.post("/api/domains", headers=auth_headers, json={
        "name": "list2.com"
    })
    
    response = await client.get("/api/domains", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2
    names = [d["name"] for d in data]
    assert "list1.com" in names
    assert "list2.com" in names

@pytest.mark.asyncio
async def test_get_domain_by_id(client: AsyncClient, auth_headers):
    create_resp = await client.post("/api/domains", headers=auth_headers, json={
        "name": "detail.com"
    })
    domain_id = create_resp.json()["id"]

    response = await client.get(f"/api/domains/{domain_id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["name"] == "detail.com"

@pytest.mark.asyncio
async def test_duplicate_domain_fails(client: AsyncClient, auth_headers):
    await client.post("/api/domains", headers=auth_headers, json={
        "name": "duplicate.com"
    })
    response = await client.post("/api/domains", headers=auth_headers, json={
        "name": "duplicate.com"
    })
    assert response.status_code == 400
