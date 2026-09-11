"""add_root_domain_to_asset_type

Revision ID: 05f0c5369362
Revises: 12ae505a4bfa
Create Date: 2026-07-21 09:45:08.437107

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '05f0c5369362'
down_revision: Union[str, None] = '12ae505a4bfa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # In PostgreSQL, ALTER TYPE ADD VALUE cannot be executed inside a transaction block unless we commit first,
    # or use autocommit. Many setups allow this if it's the only statement or we commit.
    op.execute("COMMIT")
    op.execute("ALTER TYPE assettype ADD VALUE IF NOT EXISTS 'root_domain'")
    
    # Data migration: update existing root domains
    op.execute("""
        UPDATE assets 
        SET type = 'root_domain' 
        FROM domains 
        WHERE assets.domain_id = domains.id 
          AND assets.hostname = domains.name
    """)

def downgrade() -> None:
    op.execute("""
        UPDATE assets 
        SET type = 'subdomain' 
        WHERE type = 'root_domain'
    """)
    # PostgreSQL doesn't support removing an enum value easily, so we leave it in the type.
