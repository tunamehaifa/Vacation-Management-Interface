# Vacation-Management-Interface

## Technical decisions

- **End date strictly after start date.** A one-day vacation would make sense, but I followed
  the description literally (`end_date > start_date`).
- **A vacation may start today.** "Requests in the past are not allowed" is read as
  `start_date >= today`; "today" is the server's UTC date.
- **Only Pending requests can change.** The requester can edit or cancel a Pending request;
  once approved or rejected, it is final (409). Cancelling deletes the row, since the
  assignment defines only three statuses.
- **Team planning is a monthly timeline** (both roles): who is away when, Approved and Pending.
  A reason can be personal, so only validators and the owner see it; colleagues see just the dates.
- **PostgreSQL enums** for `user_role` and `vacation_request_status`. A string field would
  accept any value, and separate tables would be overengineering for a few fixed values.
- **Rules also enforced by the database**: date order, a comment on rejection, and no
  overlapping requests per user (`EXCLUDE` constraint), so even concurrent requests can't break them.
- **Small hand-written migrations**, one purpose each, so the schema is easy to read.
- **JWT in `localStorage`, sent as `Authorization: Bearer`.** An httpOnly cookie is safer, but would be overengineering here.
- **`GET /auth/me` after a page reload.** The frontend keeps only the token; on start it asks
  the API who the user is, so an expired token is noticed right away.
- **CommandBus + EventBus with middleware.** Every command passes logging → authorization, and
  declares its allowed roles itself. Reads have no bus, so their roles are checked on the route.
- **Honestly, this is more architecture than such a small service needs.** A plain route → service
  layer would be simpler. Commands and events are here because the assignment asks for them.
  NestJS with `@nestjs/cqrs` would give these buses for free, but the required Common Event
  Framework already is the HTTP/Lambda layer, so I wrote small buses of my own.
- **Events make a request history easy to add.** Every change already publishes an event, and
  one subscriber writes it to an audit log. A `vacation_request_history` table (who changed
  what, when) would be one more subscriber, with no change to the commands. Not built, as it
  is not required.
- **Logging with pino**: one line per HTTP request, login, command, query and event; readable
  locally, JSON when deployed. Only ids and dates are logged, never reasons or comments.
- **Vite proxies `/api` to the backend**, so the browser never makes cross-origin requests and
  CORS does not come into play during development.
