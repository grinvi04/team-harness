import sqlalchemy as sa
from alembic import op

revision = "0106"


def upgrade() -> None:
    note = "op.drop_table('x') removed; DROP TABLE and TRUNCATE are just prose here"
    op.add_column("webhook_events", sa.Column("note", sa.String(), nullable=True), comment=note)


def downgrade() -> None:
    pass
