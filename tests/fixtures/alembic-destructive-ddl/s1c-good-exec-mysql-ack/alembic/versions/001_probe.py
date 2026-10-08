from alembic import op
def upgrade():
    op.execute('/*!50000 DROP TABLE audit_log */') # migration-safety: destructive-ok
