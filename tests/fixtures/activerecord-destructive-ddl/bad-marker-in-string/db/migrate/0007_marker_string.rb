class MarkerString < ActiveRecord::Migration[7.1]
  def up
    note = "migration-safety: destructive-ok"
    drop_table :legacy_events
  end
end
