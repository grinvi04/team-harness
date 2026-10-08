class Probe < ActiveRecord::Migration[7.0]
  def change
    execute 'ALTER TABLE audit_log ADD COLUMN fresh int; DROP VIEW old_view'
  end
end
