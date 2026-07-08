class TruncateFunc < ActiveRecord::Migration[7.1]
  def up
    execute("UPDATE prices SET amount = TRUNCATE(amount, 2)")
  end
end
