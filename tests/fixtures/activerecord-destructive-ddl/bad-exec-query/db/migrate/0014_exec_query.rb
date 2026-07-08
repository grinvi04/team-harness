class ExecQuery < ActiveRecord::Migration[7.1]
  def change
    connection.exec_query("DROP TABLE legacy_events")
  end
end
