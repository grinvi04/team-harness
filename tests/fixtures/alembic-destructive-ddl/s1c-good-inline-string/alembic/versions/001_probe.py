from alembic import op
def upgrade(): note = 'op.drop_table("audit_log")' # op.drop_table('audit_log')
