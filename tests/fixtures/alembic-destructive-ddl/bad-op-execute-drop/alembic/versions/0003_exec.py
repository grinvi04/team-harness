from alembic import op

revision = "0003"


def upgrade() -> None:
    op.execute("DROP TABLE webhook_events")


def downgrade() -> None:
    pass
