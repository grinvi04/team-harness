class Probe < ActiveRecord::Migration[7.0]
  def change
    execute "/*!50000 SELECT 'DROP TABLE audit_log' */"
  end
end
