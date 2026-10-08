from alembic import op
def upgrade(): op.drop_table('audit_log')
