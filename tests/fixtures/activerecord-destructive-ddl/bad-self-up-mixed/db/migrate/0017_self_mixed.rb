class MixedSelf < ActiveRecord::Migration[7.1]
  def change
    add_column :users, :flag, :boolean
  end

  def self.up
    drop_table :legacy_events
  end
end
