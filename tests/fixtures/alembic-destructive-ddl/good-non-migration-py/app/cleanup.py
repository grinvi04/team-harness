# 일반 앱 모듈 — alembic 마이그레이션 아님(from alembic import op / def upgrade / revision 없음).
def cleanup(db):
    db.execute("DROP TABLE temp_scratch")
    op_like = "op.drop_table"
    return op_like
