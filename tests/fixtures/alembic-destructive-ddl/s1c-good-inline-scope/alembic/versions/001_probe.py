from alembic import op
def upgrade(): op.create_table('audit_log')
def downgrade(): op.drop_table('audit_log')
def helper(): op.drop_table('audit_log')
