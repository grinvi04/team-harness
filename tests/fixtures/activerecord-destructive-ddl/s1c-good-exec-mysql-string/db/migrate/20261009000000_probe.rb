class Probe < ActiveRecord::Migration[7.0]
  def change
    execute "SELECT '/*!50000 DROP TABLE audit_log */'"
  end
end
