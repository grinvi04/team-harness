from alembic import op

revision = "deep-0001"
down_revision = None


def upgrade() -> None:
    op.drop_table("legacy_events")


def downgrade() -> None:
    pass
