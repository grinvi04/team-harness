from alembic import op

revision = "b08"


def upgrade(engine_name) -> None:
    globals()["upgrade_%s" % engine_name]()


def upgrade_engine1() -> None:
    op.drop_table("orders")


def downgrade(engine_name) -> None:
    pass
