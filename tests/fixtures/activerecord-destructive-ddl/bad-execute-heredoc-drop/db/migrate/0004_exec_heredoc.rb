class ExecHeredoc < ActiveRecord::Migration[7.1]
  def up
    execute(<<~SQL)
      DROP TABLE legacy_events;
    SQL
  end
end
