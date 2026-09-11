import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_multi_tenant_members(client: AsyncClient, auth_headers, second_org_headers):
    # Org1 lists members
    org1_resp = await client.get("/api/members", headers=auth_headers)
    org1_members = org1_resp.json()
    assert any(m["email"] == "admin@test.com" for m in org1_members)
    assert not any(m["email"] == "admin2@other.com" for m in org1_members)

    # Org2 lists members
    org2_resp = await client.get("/api/members", headers=second_org_headers)
    org2_members = org2_resp.json()
    assert any(m["email"] == "admin2@other.com" for m in org2_members)
    assert not any(m["email"] == "admin@test.com" for m in org2_members)

@pytest.mark.asyncio
async def test_multi_tenant_domains(client: AsyncClient, auth_headers, second_org_headers):
    # Org1 creates domain
    await client.post("/api/domains", headers=auth_headers, json={"name": "org1-domain.com"})
    
    # Org2 creates domain
    await client.post("/api/domains", headers=second_org_headers, json={"name": "org2-domain.com"})

    # Check Org1
    org1_resp = await client.get("/api/domains", headers=auth_headers)
    org1_names = [d["name"] for d in org1_resp.json()]
    assert "org1-domain.com" in org1_names
    assert "org2-domain.com" not in org1_names

    # Check Org2
    org2_resp = await client.get("/api/domains", headers=second_org_headers)
    org2_names = [d["name"] for d in org2_resp.json()]
    assert "org2-domain.com" in org2_names
    assert "org1-domain.com" not in org2_names

@pytest.mark.asyncio
async def test_multi_tenant_organization_isolation(client: AsyncClient, auth_headers, second_org_headers):
    # Attempting to PUT /api/organizations/me updates own org
    # We can't explicitly pass org id to update another org from this endpoint,
    # but we verify that it only affects the current user's org.
    await client.put("/api/organizations/me", headers=auth_headers, json={"name": "Updated Org 1"})
    
    org2_me = await client.get("/api/organizations/me", headers=second_org_headers)
    assert org2_me.json()["name"] != "Updated Org 1"
    assert org2_me.json()["name"] == "Other Org"

@pytest.mark.asyncio
async def test_multi_tenant_invitations(client: AsyncClient, auth_headers, second_org_headers):
    # Org1 creates invitation
    await client.post("/api/invitations", headers=auth_headers, json={
        "email": "invite-org1@test.com", "role": "readonly"
    })

    # Org2 lists invitations
    org2_resp = await client.get("/api/invitations", headers=second_org_headers)
    org2_invites = org2_resp.json()
    assert not any(inv["email"] == "invite-org1@test.com" for inv in org2_invites)
