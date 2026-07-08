from alembic import op

revision = "b05"


def upgrade() -> None:
    op.drop_table("scratch_tmp"); op.drop_table("customer_pii")  # migration-safety: destructive-ok
