import alembic.op as op

revision = "b04"


def upgrade() -> None:
    op.drop_table("temp_cache")
