class DownExec < ActiveRecord::Migration[7.1]
  def up
    add_column :users, :flag, :boolean
  end

  def down
    execute(<<~SQL)
      DROP TABLE users;
    SQL
  end
end
