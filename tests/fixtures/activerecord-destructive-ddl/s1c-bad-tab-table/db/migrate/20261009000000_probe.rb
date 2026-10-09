class Probe < ActiveRecord::Migration[7.0]
  def change
    drop_table	:audit_log
  end
end
