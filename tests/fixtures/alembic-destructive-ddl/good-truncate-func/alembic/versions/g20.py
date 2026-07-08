from alembic import op

revision = "g20"


def upgrade() -> None:
    op.execute("UPDATE prices SET amount = TRUNCATE(amount, 2)")
