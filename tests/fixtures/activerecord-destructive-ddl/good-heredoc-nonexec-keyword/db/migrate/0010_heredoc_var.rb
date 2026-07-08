class HeredocVar < ActiveRecord::Migration[7.1]
  def change
    doc = <<~TEXT
      This migration will DROP TABLE nothing, just docs.
    TEXT
    add_column :users, :note, :string
  end
end
