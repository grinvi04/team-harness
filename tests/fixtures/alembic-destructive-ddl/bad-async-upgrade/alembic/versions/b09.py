from alembic import op

revision = "b09"


async def upgrade() -> None:
    op.drop_table("orders")
