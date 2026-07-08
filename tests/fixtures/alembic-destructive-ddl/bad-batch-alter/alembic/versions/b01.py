from alembic import op

revision = "b01"


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("ssn")


def downgrade() -> None:
    pass
