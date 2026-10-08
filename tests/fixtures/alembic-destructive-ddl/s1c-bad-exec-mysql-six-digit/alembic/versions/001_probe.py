from alembic import op
def upgrade():
    op.execute('/*!100000 DROP TABLE audit_log */')
