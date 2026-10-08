class Probe < ActiveRecord::Migration[7.0]
  def up
    create_table	:audit_log
  end
  def down
    drop_table	:audit_log
  end
end
