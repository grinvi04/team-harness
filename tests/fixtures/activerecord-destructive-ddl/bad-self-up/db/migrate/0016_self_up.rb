class LegacyDrop < ActiveRecord::Migration
  def self.up
    drop_table :legacy_events
  end
end
