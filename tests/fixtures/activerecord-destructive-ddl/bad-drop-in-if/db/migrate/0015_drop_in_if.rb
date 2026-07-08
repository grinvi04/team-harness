class DropInIf < ActiveRecord::Migration[7.1]
  def change
    if table_exists?(:legacy_events)
      drop_table :legacy_events
    end
  end
end
