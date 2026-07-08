from alembic import op

revision = "b07"


def upgrade() -> None:
    marker = r"end\""
    op.drop_table("orders")
