from alembic import op

revision = "b06"


def upgrade() -> None:
    op.execute("""
DROP TABLE legacy_orders
""")
    op.add_column("x", None)
