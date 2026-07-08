class DownOnly < ActiveRecord::Migration[7.1]
  def up
    add_column :webhook_events, :event_id, :string
  end

  def down
    drop_table :webhook_events
    remove_column :webhook_events, :event_id
  end
end
