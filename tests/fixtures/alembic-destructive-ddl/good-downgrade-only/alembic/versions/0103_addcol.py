"""add event_id and idempotency unique constraint"""
import sqlalchemy as sa
from alembic import op

revision = "0103"
down_revision = "0102"


def upgrade() -> None:
    op.add_column("webhook_events", sa.Column("event_id", sa.String(), nullable=True))
    op.create_index(op.f("ix_webhook_events_event_id"), "webhook_events", ["event_id"])
    op.create_unique_constraint(
        "uq_webhook_events_customer_source_event",
        "webhook_events",
        ["customer_id", "source", "event_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_webhook_events_customer_source_event", "webhook_events", type_="unique")
    op.drop_index(op.f("ix_webhook_events_event_id"), table_name="webhook_events")
    op.drop_column("webhook_events", "event_id")
