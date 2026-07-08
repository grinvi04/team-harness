class Ack < ActiveRecord::Migration[7.1]
  def change
    drop_table :legacy_events # migration-safety: destructive-ok
  end
end
