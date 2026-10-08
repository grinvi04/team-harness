class Probe < ActiveRecord::Migration[7.0]
  def change
    execute '/*!50000 CREATE TABLE audit_log (id int) */'
  end
end
