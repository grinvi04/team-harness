from alembic import op
def upgrade():
    op.execute('ALTER TABLE audit_log ADD COLUMN fresh int; DROP VIEW old_view')
