import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"


def upgrade() -> None:
    op.drop_column("webhook_events", "event_id")


def downgrade() -> None:
    op.add_column("webhook_events", sa.Column("event_id", sa.String(), nullable=True))
