from alembic import op as o

revision = "b03"


def upgrade() -> None:
    o.drop_table("sessions")
