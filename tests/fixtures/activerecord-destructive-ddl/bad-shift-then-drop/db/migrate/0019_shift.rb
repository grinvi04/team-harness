class ShiftDrop < ActiveRecord::Migration[7.1]
  def change
    acc = []
    acc<<val
    drop_table :legacy_events
  end
end
