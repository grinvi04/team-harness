class HeredocTruncate < ActiveRecord::Migration[7.1]
  def up
    execute <<-SQL
      TRUNCATE TABLE sessions
    SQL
  end
end
