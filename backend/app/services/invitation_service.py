import secrets
import string
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.invitation import Invitation

async def generate_invitation_token() -> str:
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for i in range(32))

async def send_invitation_email(email: str, token: str):
    # Simulate email sending
    print(f"SIMULATED EMAIL: To {email}, invitation token: {token}")
