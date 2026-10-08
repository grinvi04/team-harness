from alembic import op
def upgrade(): op.drop_table('audit_log'); op.drop_table('other_log') # migration-safety: destructive-ok
