from alembic import op

revision = "g01"


def upgrade() -> None:
    # migration-safety: destructive-ok
    op.drop_table("orders")
