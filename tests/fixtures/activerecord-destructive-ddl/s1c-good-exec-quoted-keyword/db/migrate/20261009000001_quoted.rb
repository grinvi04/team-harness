class Probe < ActiveRecord::Migration[7.0]
  def change
    execute 'SELECT "DROP TABLE" FROM audit_log'
  end
end
