from alembic import op

revision = "0104"


def upgrade() -> None:
    op.drop_index("ix_old", table_name="webhook_events")
    op.drop_constraint("uq_old", "webhook_events", type_="unique")


def downgrade() -> None:
    pass
