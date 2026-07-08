from alembic import op

revision = "0004"


def upgrade() -> None:
    op.drop_column("webhook_events", "# migration-safety: destructive-ok")


def downgrade() -> None:
    pass
