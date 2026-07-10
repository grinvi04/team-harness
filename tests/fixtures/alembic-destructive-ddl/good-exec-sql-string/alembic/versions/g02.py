from alembic import op

revision = "g02"


def upgrade() -> None:
    op.execute("INSERT INTO audit_log (msg) VALUES ('DROP TABLE was blocked')")
