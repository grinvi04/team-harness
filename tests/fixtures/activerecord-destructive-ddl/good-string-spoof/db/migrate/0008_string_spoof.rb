class StringSpoof < ActiveRecord::Migration[7.1]
  def up
    say "would drop_table :legacy_events here"
    add_column :users, :active, :boolean
  end
end
