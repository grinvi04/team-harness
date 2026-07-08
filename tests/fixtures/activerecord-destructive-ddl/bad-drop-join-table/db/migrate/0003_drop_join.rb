class DropJoin < ActiveRecord::Migration[7.1]
  def change
    drop_join_table(:users, :roles)
  end
end
