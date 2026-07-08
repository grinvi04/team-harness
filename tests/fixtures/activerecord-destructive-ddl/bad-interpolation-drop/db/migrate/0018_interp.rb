class InterpDrop < ActiveRecord::Migration[7.1]
  def up
    execute("SET FOREIGN_KEY_CHECKS = #{fk}; DROP TABLE legacy_events")
  end
end
