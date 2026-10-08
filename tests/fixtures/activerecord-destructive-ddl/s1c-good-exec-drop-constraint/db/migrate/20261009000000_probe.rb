class Probe < ActiveRecord::Migration[7.0]
  def change
    execute 'ALTER TABLE audit_log DROP CONSTRAINT old_constraint'
  end
end
