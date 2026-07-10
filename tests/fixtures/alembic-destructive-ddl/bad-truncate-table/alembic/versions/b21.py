from alembic import op

revision = "b21"


def upgrade() -> None:
    op.execute("TRUNCATE TABLE sessions")
