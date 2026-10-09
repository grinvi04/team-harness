class Probe < ActiveRecord::Migration[7.0]
  def change
    drop_join_table	:accounts, :roles
  end
end
