from alembic import op
def upgrade():
    op.execute("/*!50000 SELECT 'DROP TABLE audit_log' */")
