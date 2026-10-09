class Probe < ActiveRecord::Migration[7.0]
  def change
    execute '/* DROP TABLE audit_log */ SELECT 1'
  end
end
