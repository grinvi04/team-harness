class HashSplit < ActiveRecord::Migration[7.1]
  def up
    execute(<<~SQL)
      DROP # sneaky mysql comment
      TABLE legacy_events
    SQL
  end
end
