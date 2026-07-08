class ExecString < ActiveRecord::Migration[7.1]
  def change
    execute("DROP TABLE archived_orders")
  end
end
