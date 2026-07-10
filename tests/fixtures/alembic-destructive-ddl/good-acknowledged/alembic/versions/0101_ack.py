import sqlalchemy as sa
from alembic import op

revision = "0101"


def upgrade() -> None:
    op.drop_column("webhook_events", "event_id")  # migration-safety: destructive-ok


def downgrade() -> None:
    op.add_column("webhook_events", sa.Column("event_id", sa.String(), nullable=True))
