class BeginEndSpoof < ActiveRecord::Migration[7.1]
  def change
=begin
drop_table :legacy_events
remove_column :users, :nickname
=end
    add_column :users, :active, :boolean
  end
end
