# Vacation-Management-Interface

## Technical decisions

- **End date strictly after start date.** A one-day vacation would make sense, but I followed
  the description literally (`end_date > start_date`).
- **PostgreSQL enums** for `user_role` and `vacation_request_status`. A string field would
  accept any value, and separate tables would be overengineering for a few fixed values.
- **Rules also enforced by the database**: date order, a comment on rejection, and no
  overlapping requests per user (`EXCLUDE` constraint), so even concurrent requests can't break them.
- **Small hand-written migrations**, one purpose each, so the schema is easy to read.
