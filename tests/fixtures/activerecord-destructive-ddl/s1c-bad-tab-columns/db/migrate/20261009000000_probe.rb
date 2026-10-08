class Probe < ActiveRecord::Migration[7.0]
  def change
    remove_columns	:audit_log, :old_col, :other_col
  end
end
