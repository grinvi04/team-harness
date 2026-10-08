from alembic import op
def upgrade(): op.drop_column('audit_log', 'old_col')
