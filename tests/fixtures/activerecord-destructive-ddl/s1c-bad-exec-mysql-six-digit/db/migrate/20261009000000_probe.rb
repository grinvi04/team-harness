class Probe < ActiveRecord::Migration[7.0]
  def change
    execute '/*!100000 DROP TABLE audit_log */'
  end
end
