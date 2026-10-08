from alembic import op
def upgrade():
    op.execute('DROP /*!50000 TABLE */ audit_log')
