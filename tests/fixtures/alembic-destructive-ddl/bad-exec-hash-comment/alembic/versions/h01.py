from alembic import op

revision = "h01"


def upgrade() -> None:
    op.execute("""
        DROP # sneaky mysql comment
        TABLE legacy_events
    """)
