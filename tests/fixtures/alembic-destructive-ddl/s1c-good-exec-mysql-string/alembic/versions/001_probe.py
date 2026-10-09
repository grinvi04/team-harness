from alembic import op
def upgrade():
    op.execute("SELECT '/*!50000 DROP TABLE audit_log */'")
