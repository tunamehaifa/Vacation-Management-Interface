# Vacation Management Interface

A web application for vacation requests:

- **Requesters** submit requests, follow their status, and edit or cancel them while they are Pending.
- **Validators** see every request on a dashboard, filter it by status and employee, and approve or
  reject it. A rejection needs a comment.
- **Both roles** see the team planning: who is away when, one month at a time.

**Stack:** Vue 3 + Vue Router + Pinia + Axios + Tailwind CSS · Node.js on the
[Common Event Framework](https://www.npmjs.com/package/commoneventframework) (CEF) · PostgreSQL 16 + TypeORM ·
JWT auth · pino logging · Vitest.

## Installation and running

**You need** Node.js 22.18+ (or 24.12+) and Docker.

### Quick start

From the repository root:

```bash
npm run setup   # installs everything, creates backend/.env, starts PostgreSQL, migrates, seeds
npm run dev     # starts PostgreSQL, the API (:8888) and the frontend (:5173) together
```

Open http://localhost:5173 and sign in with a [demo account](#demo-accounts). `npm run db:reset`
starts again from a clean database.

### Step by step

The same, one part at a time, each in its own terminal.

#### 1. Database setup

```bash
docker compose up -d
```

This starts PostgreSQL 16 on **port 5433**, so it does not clash with a local PostgreSQL on 5432. The
user, password and database are all `vacation`.

#### 2. Backend (API on http://localhost:8888)

```bash
cd backend
cp .env.example .env
npm install
npm run migration:run   # creates the tables, constraints and indexes
npm run seed            # demo users and 35 sample requests
npm run dev
```

#### 3. Frontend (http://localhost:5173)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and sign in with a demo account.

### Demo accounts

All accounts use the password **`Password123!`**.

| Role      | Email                   |
|-----------|-------------------------|
| Validator | `validator@example.com` |
| Requester | `alice@example.com`, `bob@example.com`, `chloe@example.com` (and 11 more, e.g. `david@example.com`) |

The seed adds requests in every status, with dates relative to today. That's enough data to show
pagination on the dashboard and on the team planning. Running the seed again is safe: it updates the
users and adds sample requests only while the table is empty.

### Other commands

| Where      | Command                     | What it does                                       |
|------------|-----------------------------|----------------------------------------------------|
| root       | `npm test`                  | All backend tests: unit, then API                  |
| root       | `npm run db:reset`          | Empty database, migrations and seed again          |
| `backend`  | `npm test`                  | Unit tests: business rules, buses, pagination (no database needed) |
| `backend`  | `npm run test:api`          | API integration tests (needs `docker compose up -d`), see below |
| `backend`  | `npm run typecheck`         | TypeScript check                                   |
| `backend`  | `npm run migration:revert`  | Undo the last migration                            |
| `backend`  | `npm run codegen`           | Regenerate the handler registry after editing `root.yaml` |
| `frontend` | `npm run build`             | Type check and production build                    |

**API integration tests** (`backend/tests/api`) send real HTTP requests to the real server. They
create their own database (`vacation_api_test`, dropped afterwards), run the migrations and start
the API on port 8897, so your data is never touched. They cover:
- login and protected routes;
- all six business rules, including two identical requests sent at the same moment;
- someone else's request (404);
- pagination with no row repeated or skipped;
- filters;
- hiding reasons on the team planning.

`backend/requests/*.http` are ready-made API calls for the VS Code
[REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) extension. They
log in, then create, filter, page, approve and reject requests.

## Approach: how it works

### Backend

```
HTTP ─▶ CEF router (root.yaml) ─▶ input parser (zod) ─▶ handler
                                                          │
             writes: CommandBus ─▶ logging ─▶ authorization (roles) ─▶ command handler ─▶ PostgreSQL
                                                                              │
                                                                   EventBus ─▶ subscribers (audit log)
             reads:  query function ─▶ PostgreSQL (paged)
```

- **`root.yaml`** lists every route with its handler and parser. It is also the OpenAPI description of the API.
- **Handlers** (`src/handlers`) only parse input and pass it on. They contain no business logic.
- **Commands** (`src/vacation-requests/commands`) are the only way to change data:
  - `CreateVacationRequestCommand`, `UpdateVacationRequestCommand`, `CancelVacationRequestCommand`,
    `ApproveVacationRequestCommand` and `RejectVacationRequestCommand`;
  - each declares which roles may run it, and the CommandBus checks that before the handler runs;
  - after its transaction commits, a command publishes an **event**, e.g. `VacationRequestApprovedEvent`.
- **Rules** (`src/vacation-requests/rules.ts`) are plain functions with unit tests. The database
  repeats the important ones as constraints.
- **Reads** (`src/vacation-requests/queries.ts`) are plain functions. Roles for reads are checked on the route.

| Business rule                         | Checked in code                                   | Also guaranteed by the database          |
|---------------------------------------|---------------------------------------------------|------------------------------------------|
| 1. End date after start date          | `assertValidPeriod`                               | `CHECK (end_date > start_date)`          |
| 2. No overlapping requests per user   | `assertNoOverlap`, inside the transaction         | `EXCLUDE USING gist` on the date range   |
| 3. Approved requests can't be modified | `assertPending`, with the row locked              | —                                        |
| 4. No requests in the past            | `assertValidPeriod` (start ≥ today); `assertNotStarted` on approval | — (depends on "today")  |
| 5. Rejection needs a comment          | `requireRejectionComment`                         | `CHECK` on `status` and `comments`       |
| 6. Only validators approve or reject  | `static access = [UserRole.Validator]` on both commands | —                                  |

**Errors:** every error has the same shape, `{ "error": { "code", "message", "details"? } }`, with
status 400, 401, 403, 404 or 409. Anything unexpected is logged and answered with a plain 500.

**Pagination:** list routes take `?page=&limit=` (default 10, max 100) and answer
`{ items, page, limit, total, totalPages }`. Paging happens in SQL (`LIMIT/OFFSET`). Every order ends on
`id`, so no row is shown twice or skipped.

### API

| Method & path                         | Who        | What                                               |
|---------------------------------------|------------|----------------------------------------------------|
| `POST /auth/login`                    | anyone     | Email + password → JWT and the user                |
| `GET /auth/me`                        | signed in  | The current user (used after a page reload)        |
| `POST /vacation-requests`             | Requester  | Submit a request                                   |
| `GET /vacation-requests/mine`         | Requester  | My requests, paged                                 |
| `PUT /vacation-requests/:id`          | Requester  | Change my Pending request                          |
| `DELETE /vacation-requests/:id`       | Requester  | Cancel my Pending request                          |
| `GET /vacation-requests`              | Validator  | All requests, `?status=&userId=`, paged            |
| `GET /vacation-requests/:id`          | Validator  | One request                                        |
| `POST /vacation-requests/:id/approve` | Validator  | Approve                                            |
| `POST /vacation-requests/:id/reject`  | Validator  | Reject, body `{ "comment" }`                       |
| `GET /team/vacations`                 | both       | Approved and Pending vacations in `?from=&to=`, paged by person |
| `GET /users`                          | Validator  | Users for the dashboard's employee filter          |

### Frontend

- **Pages** (`src/views`): Login, My requests (Requester), Dashboard (Validator) and Team (both). The
  router guards check sign-in and role.
- **Reusable components** (`src/components`): `BaseButton`, `FormField`, `BaseDialog`, `ConfirmDialog`,
  `PaginationBar`, `StatusBadge`, `VacationRequestForm`, `RequestsTable`, `ReviewDialog` and
  `VacationTimeline`.
- **Composables** (`src/composables`) share the logic of the pages:
  - `useQueryState` keeps filters and the page in the URL;
  - `usePagedList` loads a page, ignores late answers, and steps back from an empty page;
  - `useNotice` shows success messages that disappear after a few seconds.
- **API layer** (`src/api`): one Axios instance adds the token and turns API errors into messages. A
  401 sends the user back to the login page.
- **The Dashboard and Team pages keep their filters and page in the URL**, e.g.
  `/dashboard?status=Pending&page=2`, so reload, Back and shared links work.

### Project structure

```
backend/
  src/
    root.yaml              routes (CEF) + OpenAPI
    index.ts               entry point: routing, errors, HTTP log
    buses.ts               builds the buses, registers handlers and subscribers
    handlers/              HTTP layer: parse input, call a command or a query
    cqrs/                  CommandBus, EventBus and their middleware
    vacation-requests/     commands, events, rules, queries, repository, subscribers
    auth/                  JWT, login, route guards
    entities/              TypeORM entities
    database/              data source, migrations, seed
    http/                  errors, request parsing, pagination
  tests/                   Vitest unit tests; tests/api: API integration tests
  requests/                REST Client files
frontend/
  src/
    views/  components/  composables/  api/  stores/  router/  utils/
docker-compose.yml         PostgreSQL 16
package.json               root commands: setup, dev, test, db:reset
```

## Technical decisions

- **End date strictly after start date.** A one-day vacation would make sense, but I followed
  the description literally (`end_date > start_date`).
- **A vacation may start today.** "Requests in the past are not allowed" is read as
  `start_date >= today`; "today" is the server's UTC date.
- **A request that is still Pending when its start date passes can only be rejected.** Approving it
  would approve days in the past (rule 4). The requester can also move it to new dates.
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
- **Team planning is paged by person**, not by vacation, so a person's row is never split across pages.
- **Vite proxies `/api` to the backend**, so the browser never makes cross-origin requests and
  CORS does not come into play during development.

## Known limitations

- **No refresh token.** A session lasts 8 hours (`JWT_EXPIRES_IN`), then you sign in again. A role
  change only takes effect at the next sign-in, because the role is inside the token.
- **The token is in `localStorage`**, so a successful XSS attack could read it (see the decisions above).
- **"Today" is the server's UTC date.** Near midnight it can differ from the user's own date by one day.
- **Validators can't request vacations.** Creating requests is Requester-only, which also means a
  validator can never approve their own vacation.
