class Probe < ActiveRecord::Migration[7.0]
  def change
    remove_column	:audit_log, :old_col
  end
end
