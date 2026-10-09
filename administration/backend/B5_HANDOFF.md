# B5 Handoff — Administration Tasks Backend API Contract

> **Base path:** `/api/administration/tasks`  
> **Auth header:** All requests must carry the session token/cookie the Shared Features `apiClient` injects (handled by the real `authenticate` middleware). During the Dummy phase, the test harness sends `x-test-user-id` + `x-test-perms` headers.

---

## 1. Envelope Format

### Success

```json
{ "data": <object or array> }
```

Paginated list:
```json
{ "data": [...], "pagination": { "total": 42, "limit": 100, "offset": 0 } }
```

Status transition (returns both task and new history row):
```json
{ "data": { "task": {...}, "history": {...} } }
```

### Error

```json
{ "error": { "code": "ERROR_CODE", "message": "Human readable.", "details": [...] } }
```

`details` is present only when the error has per-item context (e.g. HIERARCHY_VIOLATION, INELIGIBLE_ASSIGNEE).

---

## 2. Permission Codes (D3)

| Permission | Who has it | Controls |
|---|---|---|
| `adm.task.create` | Any panel member with `can_assign_tasks = TRUE` | Create task, add assignees, list eligible assignees |
| `adm.task.view_all` | Manager / read-all role | See all tasks regardless of assignment |
| `adm.task.manage` | Manager / manage role | Update any task, any assignment |

Default authenticated panel members with no special permissions **see only** their own tasks (tasks where they are the assigner or an assignee).

---

## 3. Hierarchy Model (D7)

- Column: `adm_positions.hierarchy_level` — `INT NOT NULL DEFAULT 0`
- **Larger number = higher rank** (e.g. President = 100, Sub Executive = 10)
- `hierarchy_level <= 0` means **unranked** — cannot assign or be assigned
- `can_assign_tasks` flag must also be `TRUE` — even a high-ranked position can be configured to not assign (e.g. Advisor)
- The backend evaluates the acting actor's **highest active membership** in the target `panel_term_id`

### Ladder (current)

| Position | `hierarchy_level` | `can_assign_tasks` |
|---|---|---|
| President | 100 | TRUE |
| Vice President | 90 | TRUE |
| General Secretary | 80 | TRUE |
| Joint Secretary | 70 | TRUE |
| Director | 50 | TRUE |
| Assistant Director | 40 | TRUE |
| Deputy Executive | 30 | TRUE |
| Senior Sub Executive | 20 | TRUE |
| Sub Executive | 10 | FALSE |
| Unranked | 0 | FALSE |

---

## 4. Endpoint Contract Table

| Frontend function | HTTP | Notes for Connect phase |
|---|---|---|
| `listTasks(filters)` | `GET /` | Server pagination: `?limit=100&offset=0` (default 100). Returns `{ data, pagination }`. |
| `getTask(id)` | `GET /:id` | IDs are **numeric integers** (not strings). Not-visible tasks return **404**, same as unknown. |
| `createTask(payload)` | `POST /` | **Remove `assigner_membership_id` from payload** — derived from the session. Send `due_at` as ISO-8601 (`new Date(v).toISOString()`). Returns 201 + full task detail. |
| `updateTask(id, payload)` | `PATCH /:id` | Allowlisted fields only: `task_title`, `task_description`, `priority`, `due_at`, `team_id`. Passing `status` / `completed_at` / `blocked_reason` is silently ignored. |
| `deleteTask(id)` | `DELETE /:id` | **NOT AVAILABLE** — gated by Decision Gate D1 (schema change pending human approval). |
| `assignMembers(id, ids)` | `POST /:id/assignees` | Body: `{ panel_membership_ids: [number, ...] }`. Idempotent. Returns **full current assignee list**. |
| `unassignMember(id, membershipId)` | `DELETE /:id/assignees/:membershipId` | Returns 404 if `membershipId` is not assigned to the task. |
| `listEligibleAssignees({panel_term_id, team_id?})` | `GET /eligible-assignees?panel_term_id=N` | **Relative to logged-in user** — only strictly lower-ranked, active memberships. `panel_term_id` required. |
| `listTaskStatusHistory(id)` | `GET /:id/history` | ASC order. `changed_by_user_name` may be `null`. |
| `transitionTaskStatus(id, {to_status, reason})` | `PATCH /:id/status` | Returns `{ data: { task, history } }`. `reason` required when `to_status === 'BLOCKED'`. |

---

## 5. New Error Codes the UI Must Handle

| Code | HTTP | When |
|---|---|---|
| `UNAUTHENTICATED` | 401 | No valid session |
| `NO_ACTIVE_MEMBERSHIP` | 403 | No active membership in the requested `panel_term_id` |
| `CANNOT_ASSIGN_TASKS` | 403 | Position has `can_assign_tasks = FALSE` |
| `POSITION_NOT_IN_HIERARCHY` | 403 | Position has `hierarchy_level <= 0` |
| `HIERARCHY_VIOLATION` | 403 | Assignees outrank/equal the actor; `details: [{ panel_membership_id, reason }]` |
| `INELIGIBLE_ASSIGNEE` | 422 | `panel_membership_ids` that don't exist, wrong term, or inactive |
| `STATUS_UNCHANGED` | 409 | `to_status` equals current status |
| `TASK_NOT_FOUND` | 404 | Task not found or not visible |
| `VALIDATION_ERROR` | 400 | Field-level validation failures |
| `INTERNAL_ERROR` | 500 | Unexpected server error (no stack/SQL exposed) |

---

## 6. Known Limitations

- **D1 / F8 (Delete):** `DELETE /tasks/:id` is not mounted. Disable the UI delete button.
- **D6 (Multi-term):** Actor membership is resolved per `panel_term_id` in the request. No membership in that term = 403.
- **Concurrency (§2.1):** 409 STATUS_UNCHANGED under parallel transitions — reload and show current status.
- **Pagination:** Default limit 100. If UI needs all tasks for KPI cards, pass `limit=500` or add a stats endpoint.

---

## 7. Connect Phase Checklist

- [ ] Swap dummy `tasksApi.js` to real `apiClient` calls
- [ ] Handle `401` globally (redirect to login)
- [ ] Handle `403 NO_ACTIVE_MEMBERSHIP` — show "Active panel membership required"
- [ ] Handle `403 CANNOT_ASSIGN_TASKS` — hide assign UI for this user
- [ ] Handle `403 HIERARCHY_VIOLATION` — show per-assignee rejection reasons in `AssigneeSelector`
- [ ] Handle `422 INELIGIBLE_ASSIGNEE` — notify which IDs were rejected
- [ ] Handle `409 STATUS_UNCHANGED` — reload task + snackbar
- [ ] Send `due_at` as `new Date(v).toISOString()` (not a bare date string)
- [ ] **Remove `assigner_membership_id` from `createTask` payload**
- [ ] Disable delete button until D1/F8 ships
- [ ] Pass `panel_term_id` to `listEligibleAssignees`
