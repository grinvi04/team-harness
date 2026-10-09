from alembic import op
def upgrade():
    op.execute('/*!50000 CREATE TABLE audit_log (id int) */')
