"""Revision that does NOT drop_table — op.drop_table in this docstring must be ignored.

DROP TABLE / TRUNCATE mentioned in prose only.
"""
import sqlalchemy as sa
from alembic import op

revision = "0107"


def upgrade() -> None:
    sql = """
    Note about DROP TABLE and op.drop_column — documentation, not executed.
    """
    op.add_column("webhook_events", sa.Column("doc", sa.String(), nullable=True), comment=sql)


def downgrade() -> None:
    pass
