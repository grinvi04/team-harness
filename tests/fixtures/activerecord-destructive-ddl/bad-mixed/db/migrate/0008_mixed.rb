class Mixed < ActiveRecord::Migration[7.1]
  def change
    add_column :users, :active, :boolean
    remove_index :users, :email
    drop_table :legacy_events
  end
end
