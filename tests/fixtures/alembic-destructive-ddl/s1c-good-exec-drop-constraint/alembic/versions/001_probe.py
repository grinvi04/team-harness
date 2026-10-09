from alembic import op
def upgrade():
    op.execute('ALTER TABLE audit_log DROP CONSTRAINT old_constraint')
