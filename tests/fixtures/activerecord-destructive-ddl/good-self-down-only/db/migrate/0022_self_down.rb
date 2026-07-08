class SelfDownOnly < ActiveRecord::Migration
  def self.up
    add_column :users, :flag, :boolean
  end

  def self.down
    drop_table :users
  end
end
