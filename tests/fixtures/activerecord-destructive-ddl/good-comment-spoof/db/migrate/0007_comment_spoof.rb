class CommentSpoof < ActiveRecord::Migration[7.1]
  def change
    # drop_table :legacy_events -- documented, not executed
    add_column :users, :active, :boolean
  end
end
