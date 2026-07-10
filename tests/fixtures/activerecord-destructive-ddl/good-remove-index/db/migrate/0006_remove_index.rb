class RemoveIndexOnly < ActiveRecord::Migration[7.1]
  def change
    remove_index :users, :email
    remove_foreign_key :orders, :users
  end
end
