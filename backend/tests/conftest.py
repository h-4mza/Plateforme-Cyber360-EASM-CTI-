import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import ARRAY, JSONB

@compiles(ARRAY, "sqlite")
def compile_array_sqlite(type_, compiler, **kw):
    return "JSON"

@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"

from app.models.base import Base
from app.main import app
from app.database import get_db

TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def override_get_db():
    async with TestSessionLocal() as session:
        yield session

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.fixture
async def client(setup_db):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

@pytest.fixture
async def auth_headers(client: AsyncClient):
    """Register a user and return auth headers."""
    await client.post("/api/auth/register", json={
        "email": "admin@test.com",
        "password": "TestPass123!",
        "full_name": "Test Admin",
        "organization_name": "Test Org"
    })
    response = await client.post("/api/auth/login", json={
        "email": "admin@test.com",
        "password": "TestPass123!"
    })
    tokens = response.json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}

@pytest.fixture
async def second_org_headers(client: AsyncClient):
    """Register a second user in a different org for multi-tenant testing."""
    await client.post("/api/auth/register", json={
        "email": "admin2@other.com",
        "password": "TestPass123!",
        "full_name": "Other Admin",
        "organization_name": "Other Org"
    })
    response = await client.post("/api/auth/login", json={
        "email": "admin2@other.com",
        "password": "TestPass123!"
    })
    tokens = response.json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}
