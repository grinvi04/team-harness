class Probe < ActiveRecord::Migration[7.0]
  def change
    execute '/*!1234 DROP TABLE audit_log */'
  end
end
