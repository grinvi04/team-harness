from alembic import op
def upgrade() -> None: op.drop_table('audit_log')
