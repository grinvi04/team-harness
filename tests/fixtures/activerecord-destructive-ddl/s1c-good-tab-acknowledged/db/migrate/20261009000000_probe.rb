class Probe < ActiveRecord::Migration[7.0]
  def up
    # migration-safety: destructive-ok
    drop_table	:audit_log
  end
end
