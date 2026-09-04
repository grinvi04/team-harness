revoke truncate, references, trigger on all tables in schema public from anon;
grant select, insert, update, delete, truncate, references, trigger
  on all tables in schema public to authenticated;
