class AliasDrop < ActiveRecord::Migration[7.1]
  def change
    connection.drop_table :legacy_events
  end
end
