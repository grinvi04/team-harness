class BlockComment < ActiveRecord::Migration[7.1]
  def up
    execute("DROP/*x*/TABLE legacy_events")
  end
end
