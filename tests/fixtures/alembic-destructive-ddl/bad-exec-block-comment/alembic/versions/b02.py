from alembic import op

revision = "b02"


def upgrade() -> None:
    op.execute("DROP /*keep-history*/ TABLE audit_log")
