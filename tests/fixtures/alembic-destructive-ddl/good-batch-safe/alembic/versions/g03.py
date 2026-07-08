import sqlalchemy as sa
from alembic import op

revision = "g03"


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("nickname", sa.String()))
        batch_op.drop_index("ix_old")
