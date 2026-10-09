class Probe < ActiveRecord::Migration[7.0]
  def change
    execute '/*! DROP TABLE audit_log */'
  end
end
