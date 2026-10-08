from alembic import op
def upgrade():
    op.execute('/*!1234 DROP TABLE audit_log */')
