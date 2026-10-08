from alembic import op
def upgrade():
    op.execute('ALTER TABLE `audit_log` DROP `old_col`')
