class BeginMarker < ActiveRecord::Migration[7.1]
  def change
=begin
migration-safety: destructive-ok
=end
    drop_table :legacy_events
  end
end
