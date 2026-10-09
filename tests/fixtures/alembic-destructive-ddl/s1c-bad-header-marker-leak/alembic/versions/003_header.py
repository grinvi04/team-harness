from alembic import op
def upgrade(): # migration-safety: destructive-ok
    op.drop_table('audit_log')
