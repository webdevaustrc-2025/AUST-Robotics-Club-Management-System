# plan.md — Administration Tasks 8 & 9: Backend Implementation + Test Plan

**Agent target:** Antigravity
**Repository:** AUST-Robotics-Club-Management-System
**Governing contract:** `AGENTS.md` (root). Where this plan and `AGENTS.md` disagree, `AGENTS.md` wins.
**Owning module:** Administration (`administration/backend/`)
**Tables:** `adm_tasks`, `adm_task_assignees`, `adm_task_status_history` (reads `adm_panel_memberships`, `adm_positions`, `adm_teams`, `adm_panel_terms`, `core_members`)

**Revision 2:** adds the **club position hierarchy** rule (§2.1): *only a higher position may assign tasks to a lower position.* It touches B0, B1.3, B2.6, F1, F2, F5, the new slice **FH**, B4, B5 and Appendix C. Everything else is unchanged from revision 1.

This plan **replaces the backend sections** of the earlier plan. Frontend phases stay as recorded in the project summary. This plan ends with a **handoff contract** for the Connect phase; apart from the small, clearly separated **frontend alignment** item in B5.2, it does not touch the frontend.

---

## 0. Where we are

| Item | Status |
|---|---|
| Task 8 frontend (dummy data, `tasksApi.js`) | Done, **but does not enforce the hierarchy** (see B5.2) |
| Task 9 frontend (status modal, timeline) | Core done. `TaskBoardView.jsx` still pending (not a blocker) |
| Task 8 backend | **This plan** |
| Task 9 backend | **This plan** |
| Connect phase (swap dummy for HTTP) | Later, separate pass |

**Scope:** files under `administration/backend/`, test files/helpers, and the minimum wiring in root `server/` route aggregation. **No schema change is expected.** Two decisions may produce a Schema Change Proposal: D1 (task deletion) and D7 (where the hierarchy rank lives). Do not implement anything gated by them until approved.

---

## 1. Hard rules (apply to every feature)

- Layering: `routes/` → `validators/` → `controllers/` → `services/` → `repositories/`. **SQL only in repositories.**
- **Parameterized SQL only** (`$1, $2, ...`). The only permitted dynamic SQL is the `UPDATE ... SET` column list in task update, built from a **fixed allowlist of column names**, never from request keys.
- PostgreSQL syntax only. Do **not** set `updated_at` manually. The existing trigger owns it (AGENTS §16).
- **No comma-separated assignee IDs.** Assignees are rows in `adm_task_assignees`, unique on `(task_id, panel_membership_id)`.
- Statuses are exactly `TODO | IN_PROGRESS | BLOCKED | DONE`. Priorities are exactly `LOW | MEDIUM | HIGH | CRITICAL`. Define each once in `administration/backend/constants/taskConstants.js`.
- `adm_task_status_history` is **append-only**. Its repository exposes only `create` and `findByTaskId`.
- **Never trust client-supplied identity or state.** `assigner_membership_id`, `changed_by_user_id`, `assigned_by_user_id`, `status`, `completed_at`, and `blocked_reason` (on create/update) come from the authenticated session or server logic. Body fields are **allowlisted**; unknown fields are ignored.
- Identity model (AGENTS §12): `core_users.user_id` = account, `core_members.member_id` = official member, `adm_panel_memberships.panel_membership_id` = term assignment. Task assignment and the assigner use **`panel_membership_id`**. Audit columns use **`user_id`**.
- **Hierarchy is enforced on the server only** (§2.1). The frontend filter is UX, never the security boundary. **Never hardcode position names** in production code.
- No `administration/` → `event-management/` imports. No `evt_*` references. No new tables. No edits to Shared Features internals (only consume them).
- No secrets in code, logs, or error responses. Never return `password_hash` or full email addresses from join queries; select only the columns the response contract needs.

---

## 2. Canonical schema reference (verified in the earlier Phase 0)

**`adm_tasks`**: `task_id` PK identity · `panel_term_id` FK→`adm_panel_terms` · `team_id` FK→`adm_teams` · `assigner_membership_id` FK→`adm_panel_memberships` · `task_title` VARCHAR(255) NOT NULL · `task_description` TEXT NULL · `priority` VARCHAR(30) NOT NULL DEFAULT `'MEDIUM'` · `status` VARCHAR(30) NOT NULL DEFAULT `'TODO'` · `due_at` TIMESTAMPTZ NULL · `blocked_reason` VARCHAR(500) NULL · `completed_at` TIMESTAMPTZ NULL · `created_at` · `updated_at`. All FKs `ON DELETE RESTRICT`.

**`adm_task_assignees`**: `task_assignee_id` PK · `task_id` FK→`adm_tasks` RESTRICT · `panel_membership_id` FK→`adm_panel_memberships` RESTRICT · `assigned_by_user_id` FK→`core_users` SET NULL · `assigned_at` · `status` VARCHAR(30) DEFAULT `'ASSIGNED'` · `completed_at` · `created_at` · `updated_at` · `UNIQUE (task_id, panel_membership_id)`.

**`adm_task_status_history`**: `task_status_history_id` PK · `task_id` FK→`adm_tasks` RESTRICT · `from_status` NULL · `to_status` NOT NULL · `changed_by_user_id` FK→`core_users` SET NULL · `reason` VARCHAR(500) NULL · `created_at`.

### Invariants the backend must guarantee

- **I1.** Every task has a history chain ordered by `(created_at, task_status_history_id)`. The first row is `NULL → TODO`. Each row's `from_status` equals the previous row's `to_status`. The last row's `to_status` equals `adm_tasks.status`.
- **I2.** `adm_tasks.status = 'BLOCKED'` ⇔ `blocked_reason IS NOT NULL`.
- **I3.** `adm_tasks.status = 'DONE'` ⇔ `completed_at IS NOT NULL`.
- **I4.** A task row, its initial history row, and its initial assignee rows are created **atomically** (all or nothing).
- **I5.** A status change and its history row are written **atomically**.
- **I6.** *(at the moment of assignment)* Every assignee row was created by an actor whose position **strictly outranked** the assignee's position (§2.1). Later promotions/demotions do not invalidate existing rows (H4).

### 2.1 Assignment hierarchy rules

**The ladder (highest → lowest):**

```text
Director → Assistant Director → Deputy Executive → Senior Sub Executive → Sub Executive
```

Positions above Director (President, Vice President, General Secretary, Joint Secretary appear in the team plan) and any other positions are governed by **D7**. The rank values come from the **schema** (`adm_positions.hierarchy_level`), not from names in code (H8).

| ID | Rule |
|---|---|
| **H1 Strict outrank** | An assignment is allowed **only if the actor's position rank is strictly higher than the target's**. Equal rank → blocked (two Directors cannot assign each other). Lower → blocked. **Assigning to yourself → blocked** (D8). |
| **H2 Acting membership** | The actor's rank is taken from their **active membership in the task's `panel_term_id`**. If they have several active memberships in that term, use the **highest-ranked** one (ties → lowest `panel_membership_id`). None → `403 NO_ACTIVE_MEMBERSHIP`. On create, this membership becomes `assigner_membership_id`. |
| **H3 Where it applies** | (a) `POST /` (initial `panel_membership_ids`), (b) `POST /:taskId/assignees`, (c) the **eligible-assignees list**, which returns only memberships the actor may assign to. The same repository predicate/policy function serves all three. |
| **H4 Not retroactive** | Checked **at assignment time only**. A later promotion/demotion never auto-removes assignees, never blocks the assignee from reading the task or changing its status, and never changes `assigner_membership_id`. |
| **H5 No bypass** | The `manage` permission does **not** bypass the hierarchy (D9). A manager must have an acting membership and outrank the target like anyone else. |
| **H6 Atomic batch** | If **any** id in a batch violates the rule, the **whole request fails** and nothing is written. The error lists **every** offending id with a reason. |
| **H7 Codes & precedence** | Evaluation order on assignment / creation / eligible-assignee requests: (1) Authentication (`401 UNAUTHENTICATED`), (2) Active membership in task term (`403 NO_ACTIVE_MEMBERSHIP`), (3) Position task assignment flag: `can_assign_tasks = TRUE` (`403 CANNOT_ASSIGN_TASKS`, H10), (4) Actor position in hierarchy: `hierarchy_level > 0` (`<= 0` → `403 POSITION_NOT_IN_HIERARCHY`), (5) Target existence/term/active status check (nonexistent, other term, inactive → `422 INELIGIBLE_ASSIGNEE`), (6) Hierarchy policy check (`403 HIERARCHY_VIOLATION`, `details: [{ panel_membership_id, reason }]`). Reasons: `SELF`, `SAME_RANK`, `HIGHER_RANK`, `POSITION_NOT_IN_HIERARCHY`. |
| **H8 Data-driven** | Rank is `adm_positions.hierarchy_level` (`INT NOT NULL DEFAULT 0`). Larger number means higher rank, and `<= 0` means unranked. One helper, `outranks(a, b)`, owns the direction (`a > b && a > 0 && b > 0`). Never match on position **names** or `position_key` (Task 4 lets admins rename positions). |
| **H9 Scope** | The hierarchy gates **assignment only**. It does **not** gate reading a task, editing fields, status transitions, or comments. Existing ownership rules (assigner/manager for mutate; assignee/assigner/manager for transition) stay as in F3–F6. |
| **H10 Assignment flag** | The actor's acting position must have `can_assign_tasks = TRUE`. If `can_assign_tasks === FALSE`, immediately return `403 CANNOT_ASSIGN_TASKS`. This check runs right after verifying active membership, before hierarchy evaluation. It applies to: (a) task creation `POST /` (even with no initial assignees), (b) assigning members `POST /:taskId/assignees`, and (c) the eligible assignees list `GET /eligible-assignees`. |

*Accepted limitation:* the rank lookup and the insert run in the same transaction, but a concurrent edit of a position's rank by the Task 4 UI between the two statements is not locked against. Document it in the PR.

---

## 3. Decision gates

Resolve these before the feature they block. If unanswered, apply the default **and record the choice in the PR description**.

| ID | Question | Resolution | Blocks |
|---|---|---|---|
| **D1** | **Task deletion.** The frontend has a working "delete task". The schema has `ON DELETE RESTRICT` on assignees and history, history is append-only, and there is no archive column. Create writes a `NULL → TODO` history row, so a hard delete is impossible without deleting history. | **Do not mount `DELETE /tasks/:id`.** Write the Schema Change Proposal (Appendix A) and stop for approval. | F8 only |
| **D2** | **Auth source.** Does `shared-features/backend` already expose `authenticate` (sets `req.user.user_id`) and `requirePermission(code)`? | **Resolved:** Do not write authentication code in Administration. Export `createTaskRouter({ authenticate, requirePermission })`. In `server/app.js`, mount it with a placeholder that returns `501 AUTH_NOT_CONFIGURED` until Shared provides the real middleware. The required Shared interface is: `authenticate` sets `req.user = { user_id }`, and `requirePermission(code)` verifies permission on `req.user`. | Route wiring (B2) |
| **D3** | **Permission codes.** Do task permissions exist in `core_permissions`? Adding rows is a Shared/Core change. | Placeholder constants (`adm.task.create`, `adm.task.read_all`, `adm.task.manage`) in `taskConstants.js`. Do **not** seed `core_permissions`. Propose the seed separately. | Nothing (tests inject permissions) |
| **D4** | **Legal status transitions.** The PDF defines the four statuses but no rules. | **Any → any**, except same → same (`409`). Reopening `DONE` is allowed. `BLOCKED` requires a reason. | F6 |
| **D5** | **Assignee eligibility.** | Eligible = **active** membership in the task's `panel_term_id` (`status = 'ACTIVE' AND (ended_at IS NULL OR ended_at >= CURRENT_DATE)`), **and** (H1) strictly lower rank (`hierarchy_level`) than the actor's acting membership, plus the `team_id` filter if the dummy `listEligibleAssignees` applies one (B0). One shared predicate for F1/F2/F5. | F1, F2, F5 |
| **D6** | **System admins without a panel membership.** `assigner_membership_id` is NOT NULL, so they cannot create tasks, and under H2 they cannot assign either. | `403 NO_ACTIVE_MEMBERSHIP`. Documented. No schema workaround. | F2, F5 |
| **D7** | **Where does the rank live, and what about positions above Director?** `adm_positions` is described as holding "ordering/hierarchy/configuration". | **Resolved in B0:** `adm_positions.hierarchy_level` already exists in `current_schema.sql` (`INT NOT NULL DEFAULT 0`). Larger means higher rank, and `<= 0` means unranked. Authority flag is `adm_positions.can_assign_tasks`. No schema change needed. Positions with rank `<= 0` cannot assign and cannot be assigned (`POSITION_NOT_IN_HIERARCHY`). | None (resolved) |
| **D8** | **Same-rank and self assignment.** | **Blocked** (strict). A Director cannot assign to another Director or to themselves. | F1, F2, F5 |
| **D9** | **Does `manage` bypass the hierarchy?** | **No** (H5). | F2, F5 |
| **D10** | **Position data quality.** Live `adm_positions` data hierarchy maintenance. | The backend reads `hierarchy_level` and `can_assign_tasks` and never edits position data. Fixing position data is Task 4's owner (Deputy Executive). | None |

---

## 4. Agent operating protocol

1. **Read first, code second.** Finish Phase B0 completely before writing code.
2. **Tests-first per slice:** write failing tests → implement → green → lint → tick boxes → next slice. **Never start a slice with a red suite.**
3. **STOP and report** (do not improvise) if you need: a new table/column/constraint (AGENTS §14 proposal); a change inside `shared-features/`; a mismatch between `DATABASE_SCHEMA.md` and the live test DB; an unresolved **blocking** gate (D1, D7).
4. **One commit per slice**, message `feat(adm-tasks): F<n> <name>`.
5. **Never run tests against the production Neon database** (B1).

---

## Phase B0. Discovery (read-only; no code) — COMPLETED

Findings recorded in `## B0 Findings` section appended to this file.

- [x] Re-read `database/DATABASE_SCHEMA.md`, `DATABASE_RULES.md`, `TABLE_OWNERSHIP.md`, `CHANGELOG.md`, `schema/current_schema.sql` (AGENTS §1). Confirmed the three tables in §2 match.
- [x] **CHECK constraints.** Audited `adm_tasks`, `adm_task_assignees`, `adm_task_status_history`: **no DB-level CHECK constraints exist**. Invariants I2 and I3 must be enforced transactionally in backend service logic.
- [x] **How `core_users` links to `core_members`:** `core_members.user_id` FK → `core_users(user_id)`. Display name: `core_members.member_name` for member/assignees; `core_user_profiles.full_name` as fallback for `changed_by_user_name`.
- [x] **`adm_panel_memberships`:** `uk_adm_panel_memberships_history` includes `appointed_at`, `position_id`, `team_id`. A member CAN hold multiple memberships in a term. Active condition: `status = 'ACTIVE' AND (ended_at IS NULL OR ended_at >= CURRENT_DATE)`. Rule H2 selects highest-ranked active membership.
- [x] **`adm_positions` hierarchy (drives D7):**
  - [x] List every column: `position_id`, `position_key` (VARCHAR 100 UNIQUE), `position_name` (VARCHAR 150 UNIQUE), `hierarchy_level` (INT NOT NULL DEFAULT 0), `sort_order` (INT NOT NULL DEFAULT 0), `can_assign_tasks` (BOOLEAN NOT NULL DEFAULT FALSE), `status`, `created_at`, `updated_at`.
  - [x] Direction: `hierarchy_level` is `INT NOT NULL DEFAULT 0`. Larger number means higher rank, and `<= 0` means unranked.
  - [x] Stable position code: `position_key` exists. (Production code never matches on `position_key` or `position_name`; it relies strictly on `hierarchy_level` and `can_assign_tasks`).
  - [x] Read-only query / data status: DDL verified. No seed data committed in repo. Fixtures will seed test positions with explicit levels and flags.
- [x] Mount point: `server/app.js` mounts `/api` via `routes.js`. Task routes mount at `/api/administration/tasks` via factory `createTaskRouter({ authenticate, requirePermission })`.
- [x] Shared backend inventory (`shared-features/backend/`): DB pool in `database/db.js`. Auth and permissions directories are currently unpopulated. D2 resolved with 501 placeholder in `server/app.js`.
- [x] Existing backend conventions: ES Modules, 5-layer separation (`routes` → `validators` → `controllers` → `services` → `repositories`), standard JSON `{ data }` / `{ error: { code, message, details } }`.
- [x] `pg` BIGINT behavior: returns string by default. `mappers.js` explicitly casts IDs and counts to JavaScript `Number`.
- [x] Captured dummy `tasksApi.js` contract field-for-field (documented in §10 of `## B0 Findings`).
- [x] `package.json`: Node engine `v24.13.0` (exceeds `>= 20.6` requirement).
- [x] Test database: dedicated test connection via `.env.test` guarded by `tests/setup/guard.js`.

**Exit:** findings written; D2/D3/D5/D7 confirmed and resolved. Ready for Phase B1 upon user instruction.

---

## Phase B1. Test infrastructure

**Stack: Node built-in test runner (`node:test` + `node:assert`) and global `fetch`. No new dependencies** (adding any needs approval).

### B1.1 Safe test database

- [x] Add `.env.test.example` documenting `DATABASE_URL` for a **dedicated test database or Neon branch**. Add `.env.test` to `.gitignore`. Never commit it.
- [x] `administration/backend/tests/setup/guard.js`: a preload (`--import`) that **aborts the run** unless `NODE_ENV === 'test'`, `DATABASE_URL` is set, and its host/database **differ** from the `DATABASE_URL` in the developer's `.env` (parse `.env`, don't load it). Print a clear refusal. Test the guard once with a mismatched config.
- [x] npm script:
  ```
  "test:admin-tasks": "node --env-file=.env.test --import ./administration/backend/tests/setup/guard.js --test \"administration/backend/tests/unit/**/*.test.js\" \"administration/backend/tests/integration/**/*.test.js\" \"administration/backend/tests/e2e/**/*.test.js\""
  ```
  Keep helpers in `tests/setup/`, `tests/helpers/`, and `tests/harness/` (outside the scanned dirs) so they aren't run as tests. Name test files `*.test.js`.

### B1.2 Layout

```
administration/backend/tests/
├── setup/guard.js            # preload safety guard
├── helpers/fixtures.js       # create/cleanup fixture rows (positions ladder, actors)
├── helpers/testApp.js        # Express app with injected fake auth, listens on port 0
├── helpers/http.js           # fetch wrapper: asUser(userId, perms) → {get,post,patch,delete}
├── harness/                  # seed script, reset script, standalone dev server, curl guide
│   ├── seed.js               # idempotent seed script
│   ├── reset.js              # deletes only seeded rows
│   ├── devServer.js          # standalone dev server reading acting user from header
│   └── README.md             # curl commands for every endpoint
├── unit/                     # no DB (validators, mappers, hierarchyPolicy, pg-error mapping, services with fake repos)
├── integration/              # real test DB, HTTP-level, one file per slice
└── e2e/                      # full lifecycle + cross-cutting suites
```

### B1.3 Fixtures (`helpers/fixtures.js`)

- [x] Derive required columns/NOT NULLs from `current_schema.sql`, **not from memory**.
- [x] `createWorld(runId)` creates, with a unique `runId` prefix in every name/email/student-ID: an active term and an **other** term; two teams; the **position ladder** (levels and explicit `can_assign_tasks` flags); the actors below; their `core_users`, `core_members`, `adm_panel_memberships`.
- [x] **Position ladder in the test world:**
  - `President`: `hierarchy_level = 100`, `can_assign_tasks = true`, `position_key = ${runId}_PRESIDENT`
  - `Vice President`: `hierarchy_level = 90`, `can_assign_tasks = true`, `position_key = ${runId}_VICE_PRESIDENT`
  - `General Secretary`: `hierarchy_level = 80`, `can_assign_tasks = true`, `position_key = ${runId}_GEN_SEC`
  - `Joint Secretary`: `hierarchy_level = 70`, `can_assign_tasks = true`, `position_key = ${runId}_JOINT_SEC`
  - `Director`: `hierarchy_level = 50`, `can_assign_tasks = true`, `position_key = ${runId}_DIRECTOR`
  - `Assistant Director`: `hierarchy_level = 40`, `can_assign_tasks = true`, `position_key = ${runId}_ASST_DIR`
  - `Deputy Executive`: `hierarchy_level = 30`, `can_assign_tasks = true`, `position_key = ${runId}_DEPUTY_EXEC`
  - `Senior Sub Executive`: `hierarchy_level = 20`, `can_assign_tasks = true`, `position_key = ${runId}_SR_SUB_EXEC`
  - `Sub Executive`: `hierarchy_level = 10`, `can_assign_tasks = false`, `position_key = ${runId}_SUB_EXEC`
  - `Unranked Position`: `hierarchy_level = 0`, `can_assign_tasks = false`, `position_key = ${runId}_UNRANKED`
  - `Advisor Position` (high rank, no authority): `hierarchy_level = 95`, `can_assign_tasks = false`, `position_key = ${runId}_ADVISOR` (for H10 tests)
- [x] **Strict rule:** Fixtures use a unique `position_key` with `${runId}` prefix. **Production code never matches on `position_key` or `position_name`.**
- [x] **Actors** (aliases keep older test text readable):

| Actor (alias) | Position / state | Authority (`can_assign_tasks`) & Rank | Notes |
|---|---|---|---|
| `PRESIDENT` | President | `true`, level 100 | Highest executive rank |
| `VICE_PRESIDENT` | Vice President | `true`, level 90 | Executive rank |
| `GENERAL_SECRETARY` | General Secretary | `true`, level 80 | Secretarial executive |
| `JOINT_SECRETARY` | Joint Secretary | `true`, level 70 | Assistant secretarial executive |
| `DIRECTOR` (= `LEADER`) | Director, team A | `true`, level 50 | Normal task creator |
| `DIRECTOR_2` | Director, team B | `true`, level 50 | Same rank as `DIRECTOR` |
| `ASSISTANT_DIRECTOR` | Assistant Director | `true`, level 40 | |
| `MANAGER` | Assistant Director + injected `manage`/`read_all` perms | `true`, level 40 | Manager who **can** outrank juniors |
| `DEPUTY_EXECUTIVE` (= `OUTSIDER`) | Deputy Executive | `true`, level 30 | Uninvolved in most tests |
| `SENIOR_SUB` (= `ASSIGNEE_A`) | Senior Sub Executive | `true`, level 20 | |
| `SUB_EXEC` (= `ASSIGNEE_B`) | Sub Executive | `false`, level 10 | Lowest rank, cannot assign |
| `MANAGER_LOW` | Sub Executive + injected `manage` perms | `false`, level 10 | Manager who **cannot** outrank anyone and cannot assign |
| `ADVISOR_ACTOR` | Advisor position | `false`, level 95 | High rank but `can_assign_tasks = false` (tests H10) |
| `ADMIN_NO_MEMBERSHIP` | no membership + injected `manage` perms | n/a | D6/D9 |
| `NO_MEMBERSHIP` | no membership, no perms | n/a | |
| `UNRANKED` | member holding unranked position (level 0) | `false`, level 0 | |
| `DUAL` | **two active memberships in the active term**: Sub Executive (10) and Assistant Director (40) | evaluates at level 40, flag true | H2 |
| `INACTIVE` | ended/inactive membership (Sub Executive level) | `false`, level 10 | |
| `OTHER_TERM` | Sub Executive in the **other** term | `false`, level 10 | |


- [x] `cleanupWorld(runId)`: **test-only** reverse-FK deletion (history → assignees → tasks → memberships → …) restricted to rows carrying `runId`. Acceptable only in the guarded test DB.
- [x] Each test file creates its own world in `before` and cleans in `after`, so files can run in any order.
- [x] Helper `setPositionRank(membershipId, positionId)` to simulate promotion/demotion (H4 tests).

### B1.4 Test app (`helpers/testApp.js`)

- [x] Build the app through the **router factory** `createTaskRouter({ authenticate, requirePermission })`. Inject fakes: `authenticate` reads `x-test-user-id`; `requirePermission(code)` reads `x-test-perms`. Missing user header → 401.
- [x] Include the project's real global error handler so error-contract tests are meaningful.
- [x] `http.js` returns `{status, body}` and never throws on 4xx/5xx.
- [x] Default test permissions: every actor gets `adm.task.create` so hierarchy rules are tested **in isolation from RBAC**. (In production, RBAC should only grant create to leaders; that is a Shared/Core concern, D3.)

### B1.5 Smoke + schema-parity test (`integration/00.smoke.test.js`)

- [x] DB reachable (`SELECT 1`).
- [x] `information_schema.columns` contains every table/column the repositories will use, including `adm_positions.hierarchy_level` and `adm_positions.can_assign_tasks`.
- [x] Note: task tables have no DB-level CHECK constraints; enum validity is verified via validator unit tests and integration tests.
- [x] Guard test: the run refuses a `DATABASE_URL` equal to the production one (unit test of the guard function).
- [x] Fixture sanity: the created ladder is strictly ordered, `can_assign_tasks` flags match, and `outranks()` agrees with it.

### B1.6 Seed data & standalone dev harness

- [x] **Idempotent seed script (`administration/backend/tests/harness/seed.js`):**
  - Seeds deterministic fixed rows into the test database:
    - 1 active panel term (`Executive Panel 2025-2026`)
    - 2 teams (`Software & Autonomous Systems`, `Hardware, Embedded & Robotics`)
    - 5-level position ladder with levels (`Director` = 50, `Assistant Director` = 40, `Deputy Executive` = 30, `Senior Sub Executive` = 20, `Sub Executive` = 10, plus `Unranked` = 0) and explicit `can_assign_tasks` flags (true for Director/Asst Director/Deputy Exec/Senior Sub, false for Sub Exec and Unranked)
    - ~8 members with `core_users`, `core_members`, `adm_panel_memberships` (including 1 member holding two active memberships in the term)
    - A realistic set of tasks with assignees and initial status history rows.
  - Safe and idempotent: rerunning does not create duplicate rows or corrupt foreign keys.
- [x] **Seed reset script (`administration/backend/tests/harness/reset.js`):**
  - Command `seed:reset` deletes only rows created by the seed script (in reverse FK order) without wiping unrelated data.
- [x] **Standalone dev server (`administration/backend/tests/harness/devServer.js`):**
  - Reuses the `testApp.js` helper and listens on a dedicated port (e.g. `5001`).
  - Reads the acting user from a request header (`x-acting-user-id` or `x-test-user-id`).
  - **Safety constraint:** Must refuse to start unless the database guard passes (never runs against production DB).
  - **Isolation constraint:** Must never be imported or mounted in root `server/app.js`.
- [x] **npm scripts in `package.json`:**
  - `"seed:admin-tasks": "node --env-file=.env.test ./administration/backend/tests/harness/seed.js"`
  - `"seed:admin-tasks:reset": "node --env-file=.env.test ./administration/backend/tests/harness/reset.js"`
  - `"dev:admin-tasks": "node --env-file=.env.test ./administration/backend/tests/harness/devServer.js"`
- [x] **Harness documentation (`administration/backend/tests/harness/README.md`):**
  - Short reference with ready-to-run `curl` examples for every endpoint (`GET /tasks`, `GET /tasks/:id`, `POST /tasks`, `PATCH /tasks/:id`, `POST /tasks/:id/assignees`, `DELETE /tasks/:id/assignees/:id`, `PATCH /tasks/:id/status`, `GET /tasks/:id/history`, `GET /eligible-assignees`) with user headers.

**Exit:** `npm run test:admin-tasks` runs, smoke suite green, harness scripts tested and documented.

---

## Phase B2. Foundation (shared pieces for all slices)

### B2.1 Constants: `constants/taskConstants.js`
- [x] `TASK_STATUSES`, `TASK_PRIORITIES`, `DEFAULT_PRIORITY`, placeholder `TASK_PERMISSIONS` (D3), limits (title 255, reason/blocked 500, description 10 000 safety cap, `panel_membership_ids` ≤ 50).
- [x] `HIERARCHY_VIOLATION_REASONS = ['SELF','SAME_RANK','HIGHER_RANK','POSITION_NOT_IN_HIERARCHY']`.
- [x] Error codes: `NO_ACTIVE_MEMBERSHIP`, `CANNOT_ASSIGN_TASKS`, `POSITION_NOT_IN_HIERARCHY`, `HIERARCHY_VIOLATION`, `INELIGIBLE_ASSIGNEE`, `STATUS_UNCHANGED`. **No position names.**

### B2.2 Utilities: `utils/`
- [x] `mappers.js`: row → API object. **Convert BIGINT string IDs and counts to `Number`** so responses match the dummy contract. Dates stay ISO strings.
- [x] `pgErrors.js`: `23503` FK → `422 REFERENCE_NOT_FOUND` (or `409 ASSIGNEE_IN_USE` for a RESTRICT on delete/unassign), `23505` → `409`, `23514` → `400`, `22P02`/`22003` → `400`, otherwise `500` with a generic message. Use the project's existing error class if B0 found one.
- [x] `withTransaction.js`: `await withTransaction(async (client) => ...)` on the **shared pool**: `BEGIN`/`COMMIT`/`ROLLBACK`, `client.release()` in `finally`. Skip if Shared already provides one.
- [x] `ids.js`: `parseBigintId(str)` → positive integer within BIGINT range, else a 400. Applied to every `:param`.

### B2.3 Access context: `services/taskAccess.js`
- [x] **Shared active-membership SQL fragment:** encapsulate `status = 'ACTIVE' AND (ended_at IS NULL OR ended_at >= CURRENT_DATE)` in one shared helper/fragment. Test date boundaries: `ended_at = yesterday` (inactive), `ended_at = today` (active), `ended_at = tomorrow` (active), `ended_at IS NULL` (active), `status != 'ACTIVE'` (inactive).
- [x] Repository read: `findActiveMembershipsForUser(client, user_id, panel_term_id)` → `panel_membership_id, member_id, position_id, rank, can_assign_tasks` (read-only join `adm_panel_memberships` ↔ `core_members` ↔ `adm_positions`, filtered by active membership fragment).
- [x] `resolveActingMembership(memberships)` → H2 (highest rank, ties lowest id; `null` when none).
- [x] Authority verification: `assertCanAssignTasks(actingMembership)` → checks `actingMembership.can_assign_tasks === true` (else throws `403 CANNOT_ASSIGN_TASKS`, H10) and `actingMembership.rank > 0` (else throws `403 POSITION_NOT_IN_HIERARCHY`).
- [x] Ownership/permission helpers (pure, unit-testable):
  - `canViewAll(perms)` · `canManage(perms)`
  - `canViewTask({task, actorMembershipIds, perms})`: manager/read_all, **or** assigner, **or** assignee.
  - `canMutateTask(...)`: manager, **or** the actor is the assigner (matched by **identity across all the user's memberships**, not just the active one).
  - `canTransition(...)`: manager, assigner, **or** an assignee.

### B2.4 Validators: `validators/taskValidator.js`
- [x] Pure functions returning `{ value, errors }` (no throw), field-keyed errors.
- [x] `validateCreate`, `validateUpdate`, `validateAssign`, `validateTransition`, `validateListQuery`, `validateEligibleQuery`. Trim strings; blank titles rejected; priority/status exact, case-sensitive; `due_at` valid ISO-8601 instant (or `null` on update to clear); `panel_membership_ids` an array of positive ints, **de-duplicated**.

### B2.5 Routes skeleton
- [x] `routes/taskRoutes.js` exports `createTaskRouter({ authenticate, requirePermission })`. In `server/app.js`, mount it with a placeholder that returns `501 AUTH_NOT_CONFIGURED` until Shared provides the real middleware (D2).
- [x] **Route order:** static paths (`/eligible-assignees`) are declared **before** `/:taskId`.
- [x] JSON error envelope `{ error: { code, message, details? } }`; success envelope per the B0 convention (default `{ data }`; list adds `{ data, pagination: { total, limit, offset } }`).

### B2.6 Hierarchy policy: `services/hierarchyPolicy.js` *(pure, no DB)*
- [x] `outranks(actorRank, targetRank)` → `true` only when `actorRank > targetRank && actorRank > 0 && targetRank > 0` (larger number = higher rank; direction defined **once**, here).
- [x] `classifyAssignment({ actor, target })` → `{ ok: true }` or `{ ok: false, reason }`. Order of checks:
  1. Actor has rank `<= 0`: `ACTOR_POSITION_NOT_IN_HIERARCHY`
  2. Same person (`member_id` equal): `SELF`
  3. Target has rank `<= 0`: `POSITION_NOT_IN_HIERARCHY`
  4. Equal rank (`actor.rank === target.rank`): `SAME_RANK`
  5. Target higher (`target.rank > actor.rank`): `HIGHER_RANK`
  6. Else: `{ ok: true }`
- [x] `assertCanAssign(actor, targets[])` → throws one `403 HIERARCHY_VIOLATION` whose `details` lists **every** failing target with its reason (H6); throws `403 POSITION_NOT_IN_HIERARCHY` when the actor has rank `<= 0` (H7).
- [x] `filterAssignable(actor, candidates[])` → candidates the actor may assign to (used by F1; **must use the same classifyAssignment logic**).

### Foundation tests (`unit/`, no DB)
- [x] `mappers`: string BIGINT → number, null-safe.
- [x] `ids`: `'12'` ok; `'abc'`, `'-1'`, `'0'`, `'1.5'`, `'99999999999999999999'` rejected.
- [x] `pgErrors`: each code maps to the documented status/code; unknown error → 500 with no SQL/stack text.
- [x] `taskAccess` helpers: truth table per role. `resolveActingMembership`: single, dual (highest wins), tie (lowest id), none → `null`.
- [x] Active-membership SQL boundary tests: yesterday (inactive), today (active), tomorrow (active), null end date (active), status inactive (inactive).
- [x] Authority verification: `can_assign_tasks = false` → throws `403 CANNOT_ASSIGN_TASKS`; rank `<= 0` → throws `403 POSITION_NOT_IN_HIERARCHY`.
- [x] `withTransaction` (fake client): commits on success, rolls back and rethrows on error, **always releases**.
- [x] Validators: each rule in B2.4 (table-driven).
- [x] **`hierarchyPolicy` truth table** (the direction is locked by these tests): every ordered pair of the five ladder ranks (25 cases) → ok only when actor is strictly higher; `SELF` beats `SAME_RANK`; actor rank `<= 0`; target rank `<= 0`; equal ranks; `filterAssignable` agrees with `classifyAssignment` on all 25 pairs; `assertCanAssign` aggregates **all** failures, not just the first.

**Exit:** foundation unit tests green; app boots; `GET /api/administration/tasks/eligible-assignees` without auth returns 401.

---

## Phase B3. Feature slices

Each slice = **tests → implementation → green → done-when**. Test files live in `tests/integration/` unless marked unit. Test IDs (`F2-T3`) are for PR tracking.

### F1. Eligible assignees (read), `GET /eligible-assignees?panel_term_id=&team_id=`

*Frontend counterpart: `listEligibleAssignees`.*

**Implement**
- [x] Resolve the actor's acting membership in `panel_term_id` (H2). None → `403 NO_ACTIVE_MEMBERSHIP`.
- [x] Verify assignment authority: actor position must have `can_assign_tasks = TRUE` (H10). False → `403 CANNOT_ASSIGN_TASKS`.
- [x] Actor position rank must be `> 0` (`hierarchy_level <= 0` → `403 POSITION_NOT_IN_HIERARCHY`).
- [x] `taskAssigneeRepository.findEligibleMemberships({ panel_term_id, team_id? })` → **active** memberships in the term (`status = 'ACTIVE' AND (ended_at IS NULL OR ended_at >= CURRENT_DATE)`) with `panel_membership_id, member_id (internal), rank, member_name, student_id, position_title, team_name`. Select **only** the display columns for the response (no email, no hashes).
- [x] Apply `filterAssignable(actor, candidates)` so only **strictly lower-ranked, different-person** memberships are returned (H3). This is the single predicate reused by F2/F5 (D5).
- [x] Validator + controller + route. Requires authentication and the create/assign/manage permission.

**Tests**
- F1-T1 `DIRECTOR` sees `ASSISTANT_DIRECTOR`, `DEPUTY_EXECUTIVE`, `SENIOR_SUB`, `SUB_EXEC` (and not `DIRECTOR`, `DIRECTOR_2`, themselves). `INACTIVE` and `OTHER_TERM` are excluded.
- F1-T2 Per level, the list shrinks exactly as the ladder says: `ASSISTANT_DIRECTOR` → 3 levels, `DEPUTY_EXECUTIVE` → 2, `SENIOR_SUB` → 1 (`SUB_EXEC`), `SUB_EXEC` → **empty list** (200, not an error).
- F1-T3 `team_id` filter narrows the result (mirrors dummy behavior per B0) **and never widens** beyond the hierarchy.
- F1-T4 Fields: exactly the contract fields, **numeric** `panel_membership_id`, no `member_id`/email/extra personal fields in the response.
- F1-T5 `DUAL` (Sub Exec + Assistant Director) is evaluated at their **highest** membership: they see the three levels below Assistant Director.
- F1-T6 `UNRANKED` actor (`hierarchy_level = 0`) → 403 `POSITION_NOT_IN_HIERARCHY`; an unranked **target** (`hierarchy_level = 0`) never appears in anyone's list.
- F1-T7 `NO_MEMBERSHIP` and `ADMIN_NO_MEMBERSHIP` → 403 `NO_ACTIVE_MEMBERSHIP` (D6/D9).
- F1-T8 `panel_term_id` missing/non-integer → 400; unknown term → 403 `NO_ACTIVE_MEMBERSHIP` (actor has no membership there), never 500.
- F1-T9 Unauthenticated → 401; no create/assign/manage permission → 403.
- F1-T10 `/eligible-assignees` is not captured by `/:taskId` (route-order regression).
- F1-T11 `ADVISOR_ACTOR` (`can_assign_tasks = false`, high rank) → 403 `CANNOT_ASSIGN_TASKS` (H10).

**Done when:** F1-T1…T11 green; lint clean.

---

### F2. Create task, `POST /`  *(Task 8)*

*Frontend counterpart: `createTask`.*

**Implement** (one `withTransaction`)
- [x] Resolve the actor's **acting membership in `panel_term_id`** (H2) → `assigner_membership_id`. None → `403 NO_ACTIVE_MEMBERSHIP` (D6).
- [x] Verify assignment authority: actor position must have `can_assign_tasks = TRUE` (H10). False → `403 CANNOT_ASSIGN_TASKS`. **Enforced on create even if `panel_membership_ids` is empty.**
- [x] Actor position rank must be `> 0` (`hierarchy_level <= 0` → `403 POSITION_NOT_IN_HIERARCHY`).
- [x] `INSERT adm_tasks` (title, description, priority default MEDIUM, `due_at`, `team_id`, `panel_term_id`, `assigner_membership_id`; status left to the DB default `TODO`).
- [x] `INSERT adm_task_status_history` (`NULL → TODO`, `changed_by_user_id = actor`, `reason = 'Task created'`; mirror the dummy if it differs).
- [x] If `panel_membership_ids` is non-empty:
  1. Load the targets with their ranks and eligibility in **one query** (active condition: `status = 'ACTIVE' AND (ended_at IS NULL OR ended_at >= CURRENT_DATE)`).
  2. Any nonexistent/other-term/inactive → abort with `422 INELIGIBLE_ASSIGNEE` (details list the ids). **Eligibility is checked first (H7).**
  3. `assertCanAssign(actor, targets)` → abort with `403 HIERARCHY_VIOLATION` listing **every** offending id and reason (H6). Targets with `hierarchy_level <= 0` receive reason `POSITION_NOT_IN_HIERARCHY`.
  4. Insert one assignee row each (`assigned_by_user_id = actor`).
- [x] Return the full task detail (same shape as F3 detail).
- [x] `taskStatusHistoryRepository.create` is introduced here, **insert-only**.


**Tests**
- F2-T1 Minimal body → 201. DB row has `status='TODO'`, `priority='MEDIUM'`, `assigner_membership_id` = `DIRECTOR`'s membership, `completed_at`/`blocked_reason` NULL.
- F2-T2 Exactly **one** history row: `from_status` NULL, `to_status` `TODO`, `changed_by_user_id` = `DIRECTOR`.
- F2-T3 `DIRECTOR` with 3 assignees (`ASSIGNEE_A`, `ASSIGNEE_B`, `ASSISTANT_DIRECTOR`) → 3 rows, `assigned_by_user_id` = `DIRECTOR`, no duplicates.
- F2-T4 Duplicate ids in the payload are de-duplicated (still 201).
- F2-T5 One nonexistent / `OTHER_TERM` / `INACTIVE` id → 422 `INELIGIBLE_ASSIGNEE` and **nothing persisted** (task, history, assignee counts unchanged). Proves I4.
- F2-T6 **Forged fields ignored:** body includes `assigner_membership_id` (a higher person's), `status:'DONE'`, `completed_at`, `blocked_reason`, `changed_by_user_id` → server values are stored; I2/I3 hold.
- F2-T7 Validation matrix (each → 400 with a field error and **zero rows created**): missing/blank/whitespace title; 256-char title; priority `'URGENT'`/`'low'`; malformed `due_at`; `panel_membership_ids` not an array / contains `'abc'` / `-1` / >50 items; description over cap.
- F2-T8 Nonexistent `team_id` or `panel_term_id` → 422 `REFERENCE_NOT_FOUND`, never 500.
- F2-T9 `NO_MEMBERSHIP` → 403 `NO_ACTIVE_MEMBERSHIP`. `OTHER_TERM` creating in the active term → 403.
- F2-T10 Unauthenticated → 401; no create permission → 403.
- F2-T11 SQL-injection strings in title/description are stored verbatim; tables intact.
- F2-T12 Response IDs are numbers; shape matches the Appendix B detail contract.
- F2-T13 (unit, fake repos) service rolls back when the assignee insert throws, even after task + history succeeded.
- **Hierarchy & Authority (F2-H):**
  - F2-H1 `SENIOR_SUB` creates a task assigning `ASSISTANT_DIRECTOR` → 403 `HIERARCHY_VIOLATION` reason `HIGHER_RANK`; **nothing persisted**.
  - F2-H2 `DIRECTOR` assigning `DIRECTOR_2` → 403 reason `SAME_RANK`.
  - F2-H3 `DIRECTOR` assigning themselves → 403 reason `SELF`.
  - F2-H4 Mixed batch (`SENIOR_SUB` valid + `DIRECTOR_2` invalid + `SUB_EXEC` valid) → 403, `details` lists **only** `DIRECTOR_2`'s id; **zero** tasks/history/assignees created (H6).
  - F2-H5 An `UNRANKED` target (`hierarchy_level = 0`) → 403 reason `POSITION_NOT_IN_HIERARCHY`. An `UNRANKED` actor → 403 `POSITION_NOT_IN_HIERARCHY`.
  - F2-H6 `DUAL` creating a task and assigning `DEPUTY_EXECUTIVE` → 201 and `assigner_membership_id` is `DUAL`'s **Assistant Director** membership (highest).
  - F2-H7 `SENIOR_SUB` with `can_assign_tasks = true` and **no** assignees → 201.
  - F2-H8 Precedence: payload contains a nonexistent id **and** a hierarchy violator → **422** first (H7).
  - F2-H9 Actor with `can_assign_tasks = false` (e.g. `SUB_EXEC` or `ADVISOR_ACTOR`) creates a task (even with no assignees) → 403 `CANNOT_ASSIGN_TASKS` (H10).

**Done when:** F2-T1…T13 and F2-H1…H9 green.

---

### F3. List and detail, `GET /`, `GET /:taskId`  *(Task 8)*

*Frontend counterparts: `listTasks`, `getTask`.*

**Implement**
- [x] `taskRepository.findAll({ filters, visibility, limit, offset })`. Filters: `team_id`, `status`, `priority`, `search`. `search` uses `ILIKE` on title/description with `%`, `_`, `\` **escaped** in the bound parameter. Sort **exactly as the dummy** (B0) with `task_id` as the final tie-breaker.
- [x] Assignees for the page in **one extra query** (`WHERE task_id = ANY($1)`), no N+1.
- [x] **Visibility:** `read_all`/`manage` sees all; everyone else sees only tasks where one of their membership IDs is the assigner or an assignee. Enforced **in SQL**. (Hierarchy does not affect visibility, H9.)
- [x] `limit` default 100, max 500; `offset` ≥ 0; return `pagination.total`.
- [x] Detail: task + `assigner` (membership id, member name, position title) + `assignees[]` (`task_assignee_id, panel_membership_id, member_name, student_id, position_title, team_name, status`) + current `status`, `blocked_reason`, `completed_at`. Not visible/nonexistent → **404**.

**Tests**
- F3-T1 `MANAGER` lists all seeded tasks. `ASSIGNEE_A` sees only tasks they're assigned to or created. `OUTSIDER` sees none.
- F3-T2 Filters `team_id`, `status`, `priority` individually and combined.
- F3-T3 Search is case-insensitive over title and description; searching `%` or `_` matches **literally**; `'; --` returns an empty list, not an error.
- F3-T4 Pagination: `limit`/`offset` slices stable and non-overlapping; `total` correct; `limit=10000` clamped/rejected per the documented rule; `limit=-1` → 400.
- F3-T5 Sort order matches the documented order and is deterministic with equal keys.
- F3-T6 **Query count:** listing 50 tasks issues ≤ 3 SQL queries (wrap the pool to count).
- F3-T7 Detail returns assignees with names, student IDs, position and team, assigner info, numeric IDs.
- F3-T8 Detail: unknown id → 404; `OUTSIDER` on a real task → 404; `abc` → 400; `99999999999999999999` → 400.
- F3-T9 Unauthenticated → 401.
- F3-T10 After the assignee is **promoted above** the assigner (H4), they still see the task in their list and detail.

**Done when:** F3-T1…T10 green.

---

### F4. Update task, `PATCH /:taskId`  *(Task 8)*

*Frontend counterpart: `updateTask`.*

**Implement**
- [x] Allowlisted fields only: `task_title`, `task_description`, `priority`, `due_at`, `team_id`. SET clause built from the allowlist. `due_at: null` / `task_description: null` clear the value.
- [x] Empty update (no allowed fields) → 400.
- [x] Authorization: `canMutateTask` (assigner or manager). Visible-but-not-mutable → 403; not visible → 404. **No hierarchy check** (H9): editing text never assigns anyone.
- [x] `status`, `completed_at`, `blocked_reason`, `assigner_membership_id`, `panel_term_id` in the body are **ignored** (status changes only via F6).
- [x] Do not touch `updated_at` in SQL; rely on the trigger.

**Tests**
- F4-T1 Partial update changes only the sent fields.
- F4-T2 `updated_at` increases after a successful update; `created_at` unchanged.
- F4-T3 Body `status:'DONE'`, `completed_at`, `blocked_reason`, `assigner_membership_id` → ignored (I2/I3 intact).
- F4-T4 Clearing `due_at` and `task_description` with `null` works.
- F4-T5 Changing `team_id` to a valid team works; to a nonexistent team → 422; existing assignees untouched.
- F4-T6 Validation matrix as F2-T7; empty body → 400; nothing changes on any 400.
- F4-T7 `ASSIGNEE_A` → 403, `OUTSIDER` → 404, `LEADER`/`MANAGER` → 200, unauthenticated → 401.
- F4-T8 Unknown id → 404; bad id → 400.
- F4-T9 (unit) The update-column builder only ever emits allowlisted column names, even with hostile keys (`"task_title = 'x', status"`).
- F4-T10 A `DIRECTOR` who was later demoted (H4) can still edit the text of a task they created.

**Done when:** F4-T1…T10 green.

---

### F5. Assign / unassign, `POST /:taskId/assignees`, `DELETE /:taskId/assignees/:panelMembershipId`  *(Task 8)*

*Frontend counterparts: `assignMembers`, `unassignMember`.*

**Implement**
- [x] `POST` body `{ panel_membership_ids: [...] }`. In one transaction:
  1. `canMutateTask` (assigner or manager) else 403 (not visible → 404).
  2. Resolve the actor's acting membership **in the task's `panel_term_id`** (H2). None → 403 `NO_ACTIVE_MEMBERSHIP`.
  3. Verify assignment authority: actor position must have `can_assign_tasks = TRUE` (H10). False → `403 CANNOT_ASSIGN_TASKS`.
  4. Actor position rank must be `> 0` (`hierarchy_level <= 0` → `403 POSITION_NOT_IN_HIERARCHY`).
  5. De-dupe ids. Load targets (rank + active eligibility, one query). Ineligible → `422 INELIGIBLE_ASSIGNEE`.
  6. `assertCanAssign(actor, targets)` → `403 HIERARCHY_VIOLATION` (H6). **Ids already assigned are still checked**, so a stale/forged re-add can't sneak through; they are then no-ops. Targets with `hierarchy_level <= 0` receive reason `POSITION_NOT_IN_HIERARCHY`.
  7. `INSERT ... ON CONFLICT (task_id, panel_membership_id) DO NOTHING`, `assigned_by_user_id = actor`.
  8. Respond with the full current assignee list.
- [x] `DELETE`: remove the single row; no matching row → 404. A FK RESTRICT from future dependants (e.g. Task 10 submissions) → `409 ASSIGNEE_IN_USE`. Authorization: `canMutateTask`. **No hierarchy check on removal** (H9), so a demoted assigner can still clean up their own task.
- [x] A task may legitimately end with zero assignees.

**Tests**
- F5-T1 `LEADER` adds two new assignees → both present, `assigned_by_user_id` = `LEADER`.
- F5-T2 Re-add an existing assignee plus one new → exactly one new row; no error; one row per `(task, member)`.
- F5-T3 Any ineligible id in the batch → 422 and **none** added (atomic).
- F5-T4 Eligibility uses the **task's** term: an `OTHER_TERM` member is rejected even though they exist.
- F5-T5 Unassign removes exactly that row. Unassigning a non-assignee → 404. The last assignee can be removed.
- F5-T6 (unit) `pgErrors` maps FK-restrict on delete to `409 ASSIGNEE_IN_USE`. (Integration variant if a dependent fixture is feasible per B0.)
- F5-T7 Authorization: `ASSIGNEE_A` → 403, `OUTSIDER` → 404, assigner or `MANAGER` (who outranks the target) → OK, unauthenticated → 401.
- F5-T8 Validation: empty array → 400; non-array/bad ids → 400; >50 → 400.
- F5-T9 Unknown task → 404; bad ids in the path → 400.
- **Hierarchy & Authority (F5-H):**
  - F5-H1 Task created by `ASSISTANT_DIRECTOR`; adding `DIRECTOR` → 403 `HIGHER_RANK`; adding `DEPUTY_EXECUTIVE` → OK.
  - F5-H2 Adding a same-rank peer (`ASSISTANT_DIRECTOR` adds another Assistant Director) → 403 `SAME_RANK`.
  - F5-H3 Mixed batch (valid + violating) → 403 listing only the violators; **no** rows added.
  - F5-H4 `MANAGER` (Assistant Director rank) adds `SENIOR_SUB` to a task someone else owns → OK. `MANAGER` adds `DIRECTOR` → 403 `HIGHER_RANK` (no bypass, H5). `MANAGER_LOW` adds anyone → 403 `CANNOT_ASSIGN_TASKS` (Sub Exec has flag false). `ADMIN_NO_MEMBERSHIP` → 403 `NO_ACTIVE_MEMBERSHIP`.
  - F5-H5 **Promotion/demotion after creation (H4):** (a) task by `DIRECTOR` assigns `SENIOR_SUB`; promote `SENIOR_SUB` above `DIRECTOR` in the test DB → existing assignment stays; `DIRECTOR` can still **unassign** them; but **re-adding** them is now 403 `HIGHER_RANK`. (b) Demote the task's assigner below the assignee → adding new peers/seniors fails, adding lower people still works.
  - F5-H6 `DUAL` is evaluated at their highest active membership in the task's term; with only the lower membership active (end the higher one), the same call → 403 `CANNOT_ASSIGN_TASKS`.
  - F5-H7 Precedence: nonexistent id + violator → 422 first.
  - F5-H8 Actor with `can_assign_tasks = false` (e.g. `ADVISOR_ACTOR`) attempts to assign members → 403 `CANNOT_ASSIGN_TASKS` (H10).

**Done when:** F5-T1…T9 and F5-H1…H8 green.

---

### FH. Hierarchy enforcement matrix *(cross-endpoint)*

One table-driven file, `integration/hierarchy.matrix.test.js`, that proves the rule is identical everywhere it is enforced.

- [x] **FH-T1 Create matrix:** for every ordered pair (actor level × assignee level) over the ladder levels with `can_assign_tasks = true`, `POST /` with that single assignee succeeds **iff** actor rank > assignee rank. Failures return 403 with reason `SELF`/`SAME_RANK`/`HIGHER_RANK` as appropriate.
- [x] **FH-T2 Assign matrix:** the same cases through `POST /:taskId/assignees`. The result for each cell must equal FH-T1's.
- [x] **FH-T3 List matrix:** for each actor level, `GET /eligible-assignees` returns **exactly** the set of ladder levels for which FH-T1 succeeds. (Proves the UI list and the server rule cannot drift.)
- [x] **FH-T4 Status is not gated:** `SUB_EXEC` (assignee) can move a task created by `DIRECTOR` through `TODO → IN_PROGRESS → DONE`. (Guards against over-enforcing, H9.)
- [x] **FH-T5 Forgery:** a request body `assigner_membership_id` pointing at a **Director's** membership, sent by `SUB_EXEC`, neither raises their authority nor changes the stored assigner.
- [x] **FH-T6 Positions above Director (D7):** if the real data/ladder includes President/VP/etc., add a fixture row above `Director` and assert it can assign `DIRECTOR` and `DIRECTOR` cannot assign it. If concluded out of hierarchy (`hierarchy_level = 0`), assert `POSITION_NOT_IN_HIERARCHY` instead.
- [x] **FH-T7 No name or key coupling:** rename every fixture position title and `position_key` (keep levels and flags) and rerun FH-T1. Results must not change (proves H8).
- [x] **FH-T8 Authority flag enforcement (H10):** an actor holding a position with `can_assign_tasks = false` (even with a high `hierarchy_level`) receives `403 CANNOT_ASSIGN_TASKS` on `POST /`, `POST /:taskId/assignees`, and `GET /eligible-assignees`.

**Done when:** FH-T1…T8 green.

---

### F6. Status transition, `PATCH /:taskId/status`  *(Task 9)*

*Frontend counterpart: `transitionTaskStatus`.*

**Implement** (single `withTransaction`)
- [x] `SELECT task_id, status, assigner_membership_id FROM adm_tasks WHERE task_id = $1 FOR UPDATE` (row lock serializes concurrent transitions and gives a reliable `from_status`).
- [x] Not found / not visible → 404. Not `canTransition` → 403. **No hierarchy check** (H9).
- [x] Validate `to_status` ∈ the four statuses (exact). Same as current → `409 STATUS_UNCHANGED` (D4).
- [x] `to_status = 'BLOCKED'` → `reason` required (trimmed, 1–500). Other transitions: `reason` optional (≤ 500).
- [x] `UPDATE adm_tasks SET status = $2, blocked_reason = <reason if BLOCKED else NULL>, completed_at = <now() if DONE else NULL>` (I2, I3).
- [x] `INSERT adm_task_status_history (task_id, from_status, to_status, changed_by_user_id = actor, reason)`.
- [x] Return the updated task detail plus the new history row. `changed_by_user_id` is always the session user; a body value is ignored.

**Tests**
- F6-T1 `TODO → IN_PROGRESS`: task status updated; one new history row (actor, reason null); `completed_at` NULL.
- F6-T2 `IN_PROGRESS → BLOCKED` **without** reason → 400; task unchanged; **no** history row. Whitespace-only reason → 400. 501-char reason → 400.
- F6-T3 `→ BLOCKED` with a reason: `blocked_reason` set; history carries the same reason.
- F6-T4 `BLOCKED → IN_PROGRESS`: `blocked_reason` cleared (I2).
- F6-T5 `→ DONE`: `completed_at` set. `DONE → IN_PROGRESS` clears it (I3). Both appear in history.
- F6-T6 Invalid values all → 400, no change: `'in_progress'`, `'IN PROGRESS'`, `'COMPLETED'`, `''`, `null`, `5`, missing.
- F6-T7 Same-status → 409 `STATUS_UNCHANGED`; history count unchanged.
- F6-T8 Authorization: `ASSIGNEE_A` OK; assigner OK; `MANAGER` OK; `OUTSIDER` → 404; unauthenticated → 401. A body `changed_by_user_id` for someone else is ignored.
- F6-T9 **Atomicity (unit, fake repos):** history insert throws → the status UPDATE is rolled back (I5). Status UPDATE throws → no history row.
- F6-T10 **Concurrency:** 10 parallel `TODO → IN_PROGRESS` → exactly **one** 200, nine 409; exactly one new history row.
- F6-T11 **Chain under concurrency:** parallel mixed transitions (→IN_PROGRESS, →BLOCKED+reason, →DONE) on one task → **I1 holds** whatever the interleaving.
- F6-T12 (unit) `taskStatusHistoryRepository` exports only `create` and `findByTaskId`.
- F6-T13 Unknown task → 404; bad id → 400.

**Done when:** F6-T1…T13 green.

---

### F7. Status history read, `GET /:taskId/history`  *(Task 9)*

*Frontend counterpart: `listTaskStatusHistory`.*

**Implement**
- [x] `taskStatusHistoryRepository.findByTaskId(task_id)` → `ORDER BY created_at ASC, task_status_history_id ASC`.
- [x] Join for `changed_by_user_name` (table per B0). NULL user or unresolved name → `null` (never an error). Do **not** expose email or other account data.
- [x] Fields exactly: `task_status_history_id, task_id, from_status, to_status, changed_by_user_name, reason, created_at`.
- [x] Same visibility as detail (not visible → 404).

**Tests**
- F7-T1 After create + 3 transitions: 4 rows in chronological order starting with `NULL → TODO`.
- F7-T2 Stable order when two rows share a timestamp (tie-break by id).
- F7-T3 `changed_by_user_name` populated for known actors; **null** when the user id is NULL (simulate `ON DELETE SET NULL`) with a 200.
- F7-T4 Shape: exact field set, numeric ids, ISO `created_at`, no extra personal fields.
- F7-T5 `OUTSIDER` → 404; `ASSIGNEE_A` → 200; `MANAGER` → 200; unauthenticated → 401; unknown/bad id → 404/400.
- F7-T6 Task with zero history rows (fixture legacy task) → `200 []`.

**Done when:** F7-T1…T6 green.

---

### F8. Delete task *(GATED by D1)*

- [ ] **Do not implement or mount `DELETE /:taskId` until D1 is resolved.**
- [ ] Post the Schema Change Proposal (**Appendix A**) and **stop for human approval**.
- [ ] After approval only: migration under `database/migrations/administration/`; update `DATABASE_SCHEMA.md`, `current_schema.sql`, `CHANGELOG.md` (+ `TABLE_OWNERSHIP.md`/ERD if affected); implement soft-delete with tests: archived tasks vanish from list/detail/history (404), history and assignee rows stay intact, repeated delete is safe, only assigner/manager may delete, unauthenticated → 401. **No hierarchy check on delete** (H9).
- [ ] Record in the handoff (B5) that the frontend's delete button fails until F8 ships.

---

## Phase B4. Cross-cutting verification (`tests/e2e/`)

- [x] **X1 Authorization matrix (table-driven).** Every endpoint × {`LEADER`/assigner, `ASSIGNEE_A`, `OUTSIDER`, `MANAGER`, `MANAGER_LOW`, `NO_MEMBERSHIP`, unauthenticated} → expected status. One row per cell so a regression names the exact cell.
- [x] **X2 Invariant sweep.** After the full suite, assert I1, I2, I3 for **every** test-world task. Fail with the offending `task_id`s.
- [x] **X3 Full lifecycle.** `DIRECTOR` creates a task with 2 lower assignees → `ASSIGNEE_A` moves it `IN_PROGRESS` → `BLOCKED` with reason → `IN_PROGRESS` → `DONE` → history has 5 rows in order with correct actors and reasons; detail shows `DONE` + `completed_at`.
- [x] **X4 Module boundary scan** (test reads source files): no import path containing `event-management`; no `evt_` token in `administration/backend/`; no `.query(` calls outside `repositories/` (allowlisted: `taskAccess.js`, `withTransaction.js`).
- [x] **X5 SQL-safety scan:** no template literal containing `${` inside a `.query(` call except the allowlisted update column builder.
- [x] **X6 Error contract:** every failure returns `{ error: { code, message } }`. With `NODE_ENV=production`, a forced 500 exposes no stack, SQL text, or table names.
- [x] **X7 Auth wiring smoke** — D2 placeholder returns 501 (real auth not yet wired); test harness fakeAuthenticate returns 401 for missing header. Real wiring deferred to Shared Features delivery.
- [x] **X8 Lint and build:** `npm run test:admin-tasks` is green (138 tests, 0 failures). Port conflict fixed: `env.js` defaults to 5001 (macOS ControlCenter occupies 5000).
- [x] **X9 Hierarchy sweep (I6).** In the static-rank test world (no promotions), for **every** assignee row created by the suite, assert the creating user's acting rank was strictly higher than the assignee's. Fail with the offending `task_assignee_id`s.
- [x] **X10 No name hardcoding scan:** production source under `administration/backend/` (excluding tests) contains none of the ladder position names as string literals.

---

## Phase B5. Handoff to the Connect phase

### B5.1 Contract table

Deliver this table (completed from B0 and the final implementation) in the PR description. Base path `/api/administration/tasks`.

| Frontend function (`tasksApi.js`) | HTTP | Differences the Connect phase must handle |
|---|---|---|
| `listTasks(filters)` | `GET /` | Server pagination (`limit`/`offset`, default 100). If KPI cards are computed client-side from the full list, flag it. |
| `getTask(id)` | `GET /:id` | IDs are numeric. Not-visible tasks → 404. |
| `createTask(payload)` | `POST /` | **Remove `assigner_membership_id` from the payload** (derived from the session). Send `due_at` as ISO-8601 with offset (`new Date(v).toISOString()`). New errors: `403 HIERARCHY_VIOLATION` (`details[]` with per-id `reason`), `403 NO_ACTIVE_MEMBERSHIP`, `403 POSITION_NOT_IN_HIERARCHY`, `422 INELIGIBLE_ASSIGNEE`. |
| `updateTask(id, payload)` | `PATCH /:id` | Only the five allowlisted fields apply. Status is not editable here. |
| `deleteTask(id)` | `DELETE /:id` | **Not available until D1/F8 ships.** |
| `assignMembers(id, ids)` | `POST /:id/assignees` | Idempotent; returns the full assignee list. Same new error codes as create. |
| `unassignMember(id, membershipId)` | `DELETE /:id/assignees/:membershipId` | 404 if not assigned. |
| `listEligibleAssignees({panel_term_id, team_id})` | `GET /eligible-assignees` | **Now relative to the logged-in user** (only strictly lower ranks). Empty list for the lowest rank. `403 NO_ACTIVE_MEMBERSHIP` if the user has no membership in that term. |
| `listTaskStatusHistory(id)` | `GET /:id/history` | `changed_by_user_name` may be `null`. |
| `transitionTaskStatus(id, {to_status, reason})` | `PATCH /:id/status` | `409 STATUS_UNCHANGED`; `400` when BLOCKED has no reason. |

Also document: the success/error envelope, the auth header the shared `apiClient` must send, the permission codes (D3), the hierarchy rank column and direction (D7), and known limitations (D1, D6, the §2.1 concurrency note).

### B5.2 Frontend alignment for the hierarchy *(small, separate task, do before Connect)*

The dummy layer currently lets anyone assign anyone. So the UI shows what the backend will reject. A small follow-up, **not part of the backend slices**:

- [x] Add a numeric **rank/level** to the dummy memberships in `tasksApi.js` (seed the five-level ladder). Add a mock "current user" membership so the dummy has an actor.
- [x] `listEligibleAssignees` returns only strictly lower-ranked, different-person memberships (same rule as H1/H3).
- [x] `createTask` / `assignMembers` throw an error shaped like the backend's (`code: 'HIERARCHY_VIOLATION'`, `details: [{ panel_membership_id, reason }]`) so the UI error path is exercised before Connect.
- [x] `AssigneeSelector.jsx`: shows only assignable members; empty state "No lower-ranked members available" for the lowest rank; shows per-person reasons when the API rejects.
- [x] The UI filter is **convenience only**; the backend remains authoritative (§1).

---

## Phase B6. Final checklist (AGENTS §43)

- [x] Correct module: Administration only; Shared Features consumed, not modified
- [x] Existing related code inspected (B0); no duplicate pool/auth/error/transaction helper
- [x] No Event ↔ Administration dependency (X4)
- [x] Database docs read; **no new table, column or constraint** unless D1/D7 was approved and migrated
- [x] `core_users` / `core_members` / `adm_panel_memberships` identities kept distinct
- [x] PostgreSQL syntax only; parameterized SQL only (X5)
- [x] Backend enforces authentication, permission, ownership **and the position hierarchy** independent of the frontend (X1, FH)
- [x] Hierarchy is data-driven; no position names in production code (X10, FH-T7)
- [x] History append-only and transactional (I1, I5, F6-T9…T12)
- [x] Tests ran only against the guarded test database; `.env.test` not committed
- [x] Docs/migrations updated if (and only if) a schema change was approved
- [x] Lint, build, and the full test suite pass

---

## Non-goals

- Tasks 1–7, 10, 11, 12 (other members' work). No submission, review or comment code. F5-T6 only checks error *mapping* for future dependants.
- Editing **position data or the position-management UI** (Task 4, Deputy Executive). The backend only reads ranks and reports mismatches (D10).
- **Team scoping** (e.g. "a Director may only assign within their own team"). Not requested; the hierarchy is rank-only. Say so if you want it.
- The Connect swap itself and `TaskBoardView.jsx`.
- Auth, RBAC tables, permission seeding, file storage, email delivery (Shared/Core).
- New dependencies (test frameworks, ORMs, validation libraries) without approval.

---

## Appendix A. Schema Change Proposal draft for D1 (do not apply without approval)

```text
SCHEMA CHANGE PROPOSAL

Feature: Task deletion (frontend "Delete task")
Owning module: Administration

Existing tables reviewed: adm_tasks, adm_task_assignees, adm_task_status_history
Existing columns reviewed: all columns of the three tables (see plan.md §2)
Existing relationships reviewed: assignees → tasks (RESTRICT), history → tasks (RESTRICT)

Why the existing schema is insufficient:
Creating a task writes a NULL → TODO history row, and history is append-only
(AGENTS §22). ON DELETE RESTRICT therefore makes every hard delete fail, and
deleting history rows would violate the history-preservation rule. No existing
column can represent "deleted/archived".

Proposed schema change (non-breaking, additive):
  adm_tasks.deleted_at          TIMESTAMPTZ NULL
  adm_tasks.deleted_by_user_id  BIGINT NULL  -- FK core_users(user_id) ON DELETE SET NULL

Tables affected: adm_tasks
New columns/tables: 2 columns, 0 tables (table count stays 56)
Foreign keys: deleted_by_user_id → core_users(user_id) ON DELETE SET NULL
Indexes: optionally a partial index on (team_id, status) WHERE deleted_at IS NULL
Unique constraints: none
Delete behavior: "delete" = set deleted_at/deleted_by_user_id; rows are never removed

Cross-module impact: none (Administration-owned table, no evt_* references)
Shared/Core impact: none (FK points to core_users only as a reference)

Backward compatibility: additive nullable columns; existing queries unaffected.
All new reads add "deleted_at IS NULL".
Data migration/backfill: none (all existing rows stay NULL)
Deployment order: migration → backend → frontend Connect

Migration required: YES
  database/migrations/administration/YYYYMMDDHHMMSS_adm_add_task_soft_delete.sql
Docs to update: DATABASE_SCHEMA.md, current_schema.sql, CHANGELOG.md
Human approval required: YES
```

**Alternative the owner may choose instead:** keep "no delete" and remove the frontend delete button. No schema change, but a frontend feature disappears.

---

## Appendix B. Contract capture template (fill in during B0)

For each function in the dummy `tasksApi.js`, copy:

```text
function:            name(args)
request fields:      exact keys + types
response shape:      exact keys + types (incl. nested assignees / assigner)
list sort order:     ...
error behavior:      what the dummy throws/returns on missing id, invalid input
```

The backend response shapes must match this capture **field-for-field** so the Connect phase is a transport swap, not a UI rewrite.

---

## Appendix C. Schema Change Proposal draft for D7 *(Discarded — B0 verified `hierarchy_level INT NOT NULL DEFAULT 0` already exists)*

> **Note:** Discarded during Phase B0. The column `hierarchy_level` already physically exists in `current_schema.sql` as `INT NOT NULL DEFAULT 0`. Direction: larger means higher rank, and `<= 0` means unranked. Positions with `<= 0` cannot assign and cannot be assigned. Authority flag `can_assign_tasks` also exists. No schema change needed. Preserved for reference only.

```text
SCHEMA CHANGE PROPOSAL

Feature: Task-assignment position hierarchy (only higher positions may assign to lower)
Owning module: Administration (adm_positions is owned with Task 4 / Deputy Executive)

Existing tables reviewed: adm_positions, adm_panel_memberships, adm_teams
Existing columns reviewed: <list every adm_positions column found in B0>
Existing relationships reviewed: adm_panel_memberships.position_id → adm_positions

Why the existing schema is insufficient:
<state exactly what B0 found: e.g. only a display-order column whose data does not
match the ladder, or no ordering column at all>. Matching on position names is not
acceptable because Task 4 lets admins rename positions.

Proposed schema change (additive):
  adm_positions.hierarchy_level  SMALLINT NULL
  -- convention: <1 = highest, or the larger number = higher: choose ONE, document it>
  CHECK (hierarchy_level IS NULL OR hierarchy_level > 0)
  -- NULL = position is outside the task-assignment hierarchy

Backfill (REQUIRES OWNER CONFIRMATION): Director, Assistant Director, Deputy Executive,
Senior Sub Executive, Sub Executive in strict order. Levels for President, Vice President,
General Secretary, Joint Secretary are NOT assumed; the owner must supply them or leave NULL.

Tables affected: adm_positions
New columns/tables: 1 column, 0 tables (table count stays 56)
Foreign keys: none
Indexes: none needed (tiny table)
Unique constraints: none (several positions may share a level)
Delete behavior: n/a

Cross-module impact: none (no evt_* references)
Shared/Core impact: none
Impact on other Administration owners: Task 4's position-management UI/API must expose and
validate this column. Coordinate with the Deputy Executive before merging.

Backward compatibility: additive nullable column; existing queries unaffected.
Data migration/backfill: one-time UPDATE per position, in the same migration, owner-confirmed.
Deployment order: migration → Task 4 UI update → this backend

Migration required: YES
  database/migrations/administration/YYYYMMDDHHMMSS_adm_add_position_hierarchy_level.sql
Docs to update: DATABASE_SCHEMA.md, current_schema.sql, CHANGELOG.md, TABLE_OWNERSHIP.md (if notes change)
Human approval required: YES
```

---

## B0 Findings

*Discovery executed per Phase B0 of `backendplan.md` on 2026-10-09. Read-only audit — no application code written.*

---

### 1. Canonical Schema Verification
Re-read `database/DATABASE_SCHEMA.md`, `DATABASE_RULES.md`, `TABLE_OWNERSHIP.md`, `CHANGELOG.md`, and `database/schema/current_schema.sql`.

Confirmed that the three core task tables match §2 of `backendplan.md` verbatim:
- **`adm_tasks`** (lines 911–928 in `current_schema.sql`):
  - `task_id` (`BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY`)
  - `panel_term_id` (`BIGINT NOT NULL`, FK → `adm_panel_terms(panel_term_id) ON DELETE RESTRICT`)
  - `team_id` (`BIGINT NOT NULL`, FK → `adm_teams(team_id) ON DELETE RESTRICT`)
  - `assigner_membership_id` (`BIGINT NOT NULL`, FK → `adm_panel_memberships(panel_membership_id) ON DELETE RESTRICT`)
  - `task_title` (`VARCHAR(255) NOT NULL`)
  - `task_description` (`TEXT NULL`)
  - `priority` (`VARCHAR(30) NOT NULL DEFAULT 'MEDIUM'`)
  - `status` (`VARCHAR(30) NOT NULL DEFAULT 'TODO'`)
  - `due_at` (`TIMESTAMPTZ NULL`)
  - `blocked_reason` (`VARCHAR(500) NULL`)
  - `completed_at` (`TIMESTAMPTZ NULL`)
  - `created_at` (`TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`)
  - `updated_at` (`TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`)
  - Indexes: `idx_adm_tasks_team_status (team_id, status)`, `idx_adm_tasks_due_at (due_at)`, `idx_adm_tasks_assigner (assigner_membership_id)`.
- **`adm_task_assignees`** (lines 934–948 in `current_schema.sql`):
  - `task_assignee_id` (`BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY`)
  - `task_id` (`BIGINT NOT NULL`, FK → `adm_tasks(task_id) ON DELETE RESTRICT`)
  - `panel_membership_id` (`BIGINT NOT NULL`, FK → `adm_panel_memberships(panel_membership_id) ON DELETE RESTRICT`)
  - `assigned_by_user_id` (`BIGINT NULL`, FK → `core_users(user_id) ON DELETE SET NULL`)
  - `assigned_at` (`TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`)
  - `status` (`VARCHAR(30) NOT NULL DEFAULT 'ASSIGNED'`)
  - `completed_at` (`TIMESTAMPTZ NULL`)
  - `created_at` (`TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`)
  - `updated_at` (`TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`)
  - Constraints & Indexes: `uk_adm_task_assignees UNIQUE (task_id, panel_membership_id)`, `idx_adm_task_assignees_membership (panel_membership_id)`.
- **`adm_task_status_history`** (lines 952–962 in `current_schema.sql`):
  - `task_status_history_id` (`BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY`)
  - `task_id` (`BIGINT NOT NULL`, FK → `adm_tasks(task_id) ON DELETE RESTRICT`)
  - `from_status` (`VARCHAR(30) NULL`)
  - `to_status` (`VARCHAR(30) NOT NULL`)
  - `changed_by_user_id` (`BIGINT NULL`, FK → `core_users(user_id) ON DELETE SET NULL`)
  - `reason` (`VARCHAR(500) NULL`)
  - `created_at` (`TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`)
  - Index: `idx_adm_task_status_history_task (task_id)`.

---

### 2. CHECK Constraints Audit
- **Findings:**
  - Neither `adm_tasks`, `adm_task_assignees`, nor `adm_task_status_history` has any database-level `CHECK` constraints on `status` or `priority`.
  - There is **no database-level constraint** tying `blocked_reason` to `status = 'BLOCKED'` or `completed_at` to `status = 'DONE'`.
- **Backend implication:** Invariants **I2** (`status = 'BLOCKED' ⇔ blocked_reason IS NOT NULL`) and **I3** (`status = 'DONE' ⇔ completed_at IS NOT NULL`) must be strictly and transactionally enforced in backend service logic (`services/taskStatusService.js` and `validators/taskValidator.js`).

---

### 3. User, Member, and Display Name Linkage (AGENTS.md §12)
- **`core_users`** (`user_id` PK): Account identity with `email`, `status`.
- **`core_members`** (`member_id` PK): Official club member identity with `member_code`, `member_name`, `user_id` (FK → `core_users(user_id) ON DELETE SET NULL`, UNIQUE `uk_core_members_user`).
- **`core_user_profiles`** (`user_profile_id` PK): User profile details with `full_name`, `user_id` (FK → `core_users(user_id) ON DELETE CASCADE`, UNIQUE `uk_core_user_profiles_user`).
- **Display name resolution:**
  - When displaying the member for task assignment / assigner / assignees: use `core_members.member_name` (joined via `adm_panel_memberships.member_id = core_members.member_id`).
  - When displaying `changed_by_user_name` on status history (`changed_by_user_id` = `core_users.user_id`):
    Join `core_users` ➔ `core_members.member_name` (fallback: `core_user_profiles.full_name`, fallback: `'System User'`).
    If `changed_by_user_id IS NULL`, display `null`.

---

### 4. `adm_panel_memberships` Architecture & Multi-membership Rules
- **Canonical columns** (lines 819–836 in `current_schema.sql`):
  `panel_membership_id`, `panel_term_id`, `member_id`, `position_id`, `team_id` (nullable), `appointed_at` (`DATE`), `ended_at` (`DATE NULL`), `status` (`VARCHAR(30) DEFAULT 'ACTIVE'`), `notes`, `created_at`, `updated_at`.
- **Active status representation:**
  `status = 'ACTIVE'` AND (`ended_at IS NULL OR ended_at >= CURRENT_DATE`).
- **Multiple active memberships in one term:**
  The unique constraint is `uk_adm_panel_memberships_history UNIQUE (panel_term_id, member_id, position_id, team_id, appointed_at)`.
  Because `(panel_term_id, member_id)` alone is not unique, **a club member CAN hold multiple memberships in the same term**.
  Rule **H2** holds: when an actor performs a task operation, query all active memberships for `actor.user_id` in `task.panel_term_id`, and select the **highest-ranked** active membership (ties broken by lowest `panel_membership_id`).

---

### 5. `adm_positions` Hierarchy Analysis (D7 Resolved)
- **Canonical columns in `adm_positions`** (lines 793–805 in `current_schema.sql` and `DATABASE_SCHEMA.md` §10):
  - `position_id` (`BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY`)
  - `position_key` (`VARCHAR(100) NOT NULL UNIQUE`) — stable position code
  - `position_name` (`VARCHAR(150) NOT NULL UNIQUE`) — position display title
  - `hierarchy_level` (`INT NOT NULL DEFAULT 0`) — **ALREADY EXISTS in canonical schema!**
  - `sort_order` (`INT NOT NULL DEFAULT 0`)
  - `can_assign_tasks` (`BOOLEAN NOT NULL DEFAULT FALSE`) — authority flag
  - `status` (`VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'`)
  - `created_at`, `updated_at`
- **Direction resolution:**
  - `hierarchy_level` has `DEFAULT 0`.
  - In AUSTRC schema design, unranked / default positions have `hierarchy_level = 0`.
  - Therefore, **a larger number represents a higher rank** (e.g., Director = 50, Assistant Director = 40, Deputy Executive = 30, Senior Sub-Executive = 20, Sub-Executive = 10, Unranked = 0).
  - The single policy function `outranks(actorRank, targetRank)` in `services/hierarchyPolicy.js` will encapsulate this:
    `actorRank > targetRank && actorRank > 0 && targetRank > 0`.
- **Schema status:**
  Because `adm_positions.hierarchy_level` already physically exists in `current_schema.sql` and `DATABASE_SCHEMA.md`, **NO database migration or schema proposal is needed for D7**. Appendix C is avoided.
- **Data status (D10):**
  The repository does not contain production position seed records. Tests in Phase B1/FH will seed fixture positions with explicit hierarchy levels. If live database data has unconfigured hierarchy levels, Task 4's owner (Deputy Executive) will set values via position management; the backend will treat any position with `hierarchy_level <= 0` as `POSITION_NOT_IN_HIERARCHY`.

---

### 6. Mount Point & Application Route Architecture
- **Root routing:**
  `server/app.js` mounts root routes via `app.use('/api', routes)`.
  `server/routes.js` currently only exposes `router.get('/health', ...)`.
- **Administration mount point:**
  `administration/backend/routes/taskRoutes.js` will be created with a factory function `createTaskRouter({ authenticate, requirePermission })`.
  The router will be mounted at `/api/administration/tasks` through an administration route aggregator (`administration/backend/routes/index.js`) hooked into `server/routes.js`.

---

### 7. Shared Backend Inventory (`shared-features/backend/`)
- **Inspection results:**
  - `shared-features/backend/database/db.js`: Present! Exports `pool` and `query(text, params)`.
  - `shared-features/backend/auth/`: Only `.gitkeep` (no shared middleware implemented yet).
  - `shared-features/backend/middleware/`: Only `.gitkeep`.
  - `shared-features/backend/permissions/`: Only `.gitkeep`.
  - `shared-features/backend/utils/`: Only `.gitkeep`.
- **D2 Resolution:**
  As prescribed by decision gate D2: because shared `authenticate` and `requirePermission` middleware are not yet implemented in `shared-features/backend/`, the task router is built as a router factory `createTaskRouter({ authenticate, requirePermission })`. In testing, fake auth middleware is injected via headers (`x-test-user-id`, `x-test-perms`). For production mounting before Shared Auth is wired, passthrough placeholders will be supplied without polluting production paths with mock credentials.
- **D3 Resolution:**
  Permissions `adm.task.create`, `adm.task.read_all`, `adm.task.manage` will be defined as constants in `administration/backend/constants/taskConstants.js`. No changes or seeds to `core_permissions` will be performed.

---

### 8. Existing Conventions & Layering
- **Module boundaries:** ES Modules (`import`/`export`), strict 5-layer separation:
  `routes/` ➔ `validators/` ➔ `controllers/` ➔ `services/` ➔ `repositories/`.
- **Error envelope:**
  Standardized JSON: `{ error: { code: string, message: string, details?: any } }`.
- **Success envelope:**
  Single resource: `{ data: ... }`.
  Collection: `{ data: [...], pagination: { total: number, limit: number, offset: number } }`.

---

### 9. Database Driver & `pg` Type Parsing
- In `shared-features/backend/database/db.js`, `types.setTypeParser(20, ...)` is **not** configured.
- Default `pg` driver behavior returns `BIGINT` (OID 20) columns as JavaScript `string`s.
- `mappers.js` in `administration/backend/utils/` must explicitly cast `task_id`, `panel_term_id`, `team_id`, `assigner_membership_id`, `task_assignee_id`, `panel_membership_id`, `member_id`, `user_id`, and `total` counts to JavaScript `Number`s so the HTTP contract exactly matches the dummy service. Dates will remain ISO-8601 strings.

---

### 10. Dummy API Contract Capture (Appendix B Fulfilled)

From inspection of `administration/frontend/services/tasksApi.js`:

1. **`listTasks(filters)` ➔ `GET /api/administration/tasks`**
   - Query params: `team_id` (number | 'ALL'), `status` ('TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'ALL'), `priority` ('LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'ALL'), `search` (string), `limit` (default 100), `offset` (default 0).
   - Response: `{ data: [EnrichedTask], pagination: { total, limit, offset } }`
   - Sort order: `created_at DESC, task_id DESC`.

2. **`getTask(taskId)` ➔ `GET /api/administration/tasks/:taskId`**
   - Params: `taskId` (numeric string).
   - Response: `{ data: EnrichedTask }`.
   - Error: `404 Task not found`.

3. **`createTask(payload)` ➔ `POST /api/administration/tasks`**
   - Body: `{ panel_term_id, team_id, task_title, task_description, priority, due_at, panel_membership_ids }`.
   - Response: `201` `{ data: EnrichedTask }`.
   - Notes: Creates task + initial `NULL → TODO` status history row + initial assignee rows in one transaction.

4. **`updateTask(taskId, fields)` ➔ `PATCH /api/administration/tasks/:taskId`**
   - Body: `{ task_title?, task_description?, priority?, team_id?, due_at? }`.
   - Response: `200` `{ data: EnrichedTask }`.
   - Prohibited fields: `status`, `completed_at`, `blocked_reason`, `assigner_membership_id`.

5. **`assignMembers(taskId, panelMembershipIds)` ➔ `POST /api/administration/tasks/:taskId/assignees`**
   - Body: `{ panel_membership_ids: [number] }`.
   - Response: `200` `{ data: [Assignee] }` or `{ data: EnrichedTask }`.
   - Notes: Validates rank hierarchy against each target before inserting; atomic batch.

6. **`unassignMember(taskId, panelMembershipId)` ➔ `DELETE /api/administration/tasks/:taskId/assignees/:panelMembershipId`**
   - Params: `taskId`, `panelMembershipId`.
   - Response: `200` `{ data: EnrichedTask }`.

7. **`deleteTask(taskId)` ➔ `DELETE /api/administration/tasks/:taskId`**
   - **Gated by D1:** Blocked pending decision on soft delete vs removing button. Not mounted in initial routes.

8. **`listEligibleAssignees(filters)` ➔ `GET /api/administration/tasks/eligible-assignees`**
   - Query params: `panel_term_id` (required), `team_id` (optional).
   - Response: `{ data: [{ panel_membership_id, panel_term_id, member_id, member_name, student_id, position_id, position_title, team_id, team_name, status }] }`.
   - Filtered by: Active term + active membership + strictly lower position rank than the calling actor.

9. **`listTaskStatusHistory(taskId)` ➔ `GET /api/administration/tasks/:taskId/history`**
   - Params: `taskId`.
   - Response: `{ data: [{ task_status_history_id, task_id, from_status, to_status, changed_by_user_id, changed_by_user_name, reason, created_at }] }`.
   - Sort order: `created_at ASC, task_status_history_id ASC`.

10. **`transitionTaskStatus(taskId, payload)` ➔ `PATCH /api/administration/tasks/:taskId/status`**
    - Body: `{ to_status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE', reason?: string }`.
    - Validation: Mandatory `reason` if `to_status === 'BLOCKED'`. Same status returns `409 STATUS_UNCHANGED`.
    - Response: `{ data: { task: EnrichedTask, history: StatusHistoryRow } }`.

---

### 11. Environment & Tooling Verification
- **Node Engine:** `v24.13.0` (exceeds required `v20.6` minimum; native `--env-file`, `--import`, `node:test`, `node:assert`, and `fetch` are fully supported).
- **Scripts in `package.json`:** Currently has `dev`, `build`, `lint`, `preview`, `server`, `server:dev`. A test script `test:admin-tasks` will be added in Phase B1.

---

### 12. Non-Production Test Database Status
- **Current environment state:** No `.env` or `.env.test` file is committed or present in the workspace.
- **Recommendation:** When executing Phase B1, `.env.test.example` will document the required test connection string pointing to a dedicated test database or isolated Neon branch. Safety preload guard `administration/backend/tests/setup/guard.js` will prevent test execution against any production database.

---

### 13. Summary of Resolved Decision Gates
| Gate | Decision / Status |
|---|---|
| **D1 (Task Deletion)** | **Do not mount `DELETE /tasks/:id`.** Proposal recorded in Appendix A. Stopped for owner review. |
| **D2 (Auth Source)** | **Resolved:** Do not write authentication code in Administration. Export `createTaskRouter({ authenticate, requirePermission })`. In `server/app.js`, mount it with a placeholder that returns `501 AUTH_NOT_CONFIGURED` until Shared provides the real middleware. Shared contract required: `authenticate` sets `req.user = { user_id }`; `requirePermission(code)` checks permission on `req.user`. |
| **D3 (Permissions)** | Use placeholder permission constants in `taskConstants.js`. No seeding of `core_permissions`. |
| **D4 (Transitions)** | Legal transitions: any status to any different valid status (`TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE`). Same status yields 409. `BLOCKED` requires reason. |
| **D5 (Assignee Eligibility)** | Active membership in task term (`status = 'ACTIVE' AND (ended_at IS NULL OR ended_at >= CURRENT_DATE)`), `can_assign_tasks = true` on actor (H10), and strictly lower rank than actor. |
| **D6 (Admins without Membership)** | Return `403 NO_ACTIVE_MEMBERSHIP`. Must hold active panel membership to assign or be assigned. |
| **D7 (Hierarchy Rank Location)** | **RESOLVED WITHOUT SCHEMA CHANGE.** `adm_positions.hierarchy_level` already exists in `current_schema.sql` (`INT NOT NULL DEFAULT 0`). Larger number means higher rank, and `<= 0` means unranked. Authority flag is `adm_positions.can_assign_tasks` (H10). No migration required. |

*Phase B0 is complete and all amendments are incorporated. Ready for Phase B1 upon user instruction.*