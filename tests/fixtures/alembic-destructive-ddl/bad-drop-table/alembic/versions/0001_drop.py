"""drop legacy events table"""
import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None


def upgrade() -> None:
    op.drop_table("legacy_events")


def downgrade() -> None:
    op.create_table("legacy_events", sa.Column("id", sa.Integer(), primary_key=True))
