class HeredocSafe < ActiveRecord::Migration[7.1]
  def up
    execute(<<~SQL)
      UPDATE users SET active = true WHERE active IS NULL;
    SQL
  end
end
