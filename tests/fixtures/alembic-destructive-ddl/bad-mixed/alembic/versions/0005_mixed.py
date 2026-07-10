import sqlalchemy as sa
from alembic import op

revision = "0005"


def upgrade() -> None:
    op.add_column("webhook_events", sa.Column("note", sa.String(), nullable=True))
    op.drop_table("old_table")


def downgrade() -> None:
    pass
