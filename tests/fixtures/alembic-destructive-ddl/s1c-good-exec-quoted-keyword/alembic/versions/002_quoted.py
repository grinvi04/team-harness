from alembic import op
def upgrade():
    op.execute('SELECT "DROP TABLE" FROM audit_log')
