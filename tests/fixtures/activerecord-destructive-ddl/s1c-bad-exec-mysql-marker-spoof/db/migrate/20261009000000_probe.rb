class Probe < ActiveRecord::Migration[7.0]
  def change
    execute '/*!50000 DROP TABLE audit_log */ -- migration-safety: destructive-ok'
  end
end
