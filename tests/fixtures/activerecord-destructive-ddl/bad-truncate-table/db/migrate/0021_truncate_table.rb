class TruncateTable < ActiveRecord::Migration[7.1]
  def up
    execute("TRUNCATE TABLE sessions")
  end
end
