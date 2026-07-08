class SemicolonMarker < ActiveRecord::Migration[7.1]
  def up
    drop_table :a; drop_table :b # migration-safety: destructive-ok
  end
end
