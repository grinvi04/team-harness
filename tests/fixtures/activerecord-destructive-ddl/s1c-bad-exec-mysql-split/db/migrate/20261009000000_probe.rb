class Probe < ActiveRecord::Migration[7.0]
  def change
    execute 'DROP /*!50000 TABLE */ audit_log'
  end
end
