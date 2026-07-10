from alembic import op

revision = "0102"


def upgrade() -> None:
    op.execute("DROP TABLE webhook_events")  # migration-safety: destructive-ok


def downgrade() -> None:
    pass
