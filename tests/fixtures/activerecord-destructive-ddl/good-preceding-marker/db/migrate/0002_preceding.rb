class Preceding < ActiveRecord::Migration[7.1]
  def up
    # migration-safety: destructive-ok
    remove_column :users, :nickname
  end
end
