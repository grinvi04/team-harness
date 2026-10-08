from alembic import op
def upgrade():
    op.execute('/*! DROP TABLE audit_log */')
