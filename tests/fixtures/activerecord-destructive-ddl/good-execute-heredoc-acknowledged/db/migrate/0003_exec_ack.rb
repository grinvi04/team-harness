class ExecAck < ActiveRecord::Migration[7.1]
  def up
    # migration-safety: destructive-ok
    execute(<<~SQL)
      DROP TABLE legacy_events;
    SQL
  end
end
