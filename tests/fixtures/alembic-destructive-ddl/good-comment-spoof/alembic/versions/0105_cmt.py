import sqlalchemy as sa
from alembic import op

revision = "0105"


def upgrade() -> None:
    # op.drop_table("webhook_events") -- 예전 계획, 실행 안 함. DROP TABLE 금지.
    op.add_column("webhook_events", sa.Column("x", sa.String(), nullable=True))


def downgrade() -> None:
    pass
