# Administration Tasks Dev Harness & Testing Guide

This harness provides an isolated environment for testing the Administration Tasks endpoints (Slice 8 & 9) with fake header-based authentication and seeded fixture data.

---

## 1. Safety Guard

The test harness and test runner require a dedicated test database (`.env.test`).
They strictly verify that:
1. `NODE_ENV === 'test'`
2. `DATABASE_URL` is set
3. `DATABASE_URL` does not point to the host/database declared in `.env` (protecting development/production databases).

If the guard detects a conflict or missing configuration, the process terminates immediately with an explicit refusal message.

---

## 2. Quick Start

### 2.1 Set up `.env.test`
Copy the example file:
```bash
cp .env.test.example .env.test
```
Update `DATABASE_URL` in `.env.test` to point to your isolated test PostgreSQL database or Neon test branch.

### 2.2 Seed the Test Database
Populate deterministic test data (panel terms, teams, position ladder, members, and realistic tasks):
```bash
npm run seed:admin-tasks
```

To clean up seeded rows:
```bash
npm run seed:admin-tasks:reset
```

### 2.3 Start the Standalone Dev Server
```bash
npm run dev:admin-tasks
```
The server listens on `http://localhost:5001`.

---

## 3. Seeded Users Reference

| Role | Alias | Seed User ID | Header `x-acting-user-id` | Hierarchy Rank | `can_assign_tasks` |
|---|---|---|---|---|---|
| President | `president` | *(Query or use 1)* | `1` | 100 | `true` |
| Vice President | `vp` | *(Query or use 2)* | `2` | 90 | `true` |
| General Secretary | `gen_sec` | *(Query or use 3)* | `3` | 80 | `true` |
| Joint Secretary | `joint_sec` | *(Query or use 4)* | `4` | 70 | `true` |
| Director | `director` | *(Query or use 5)* | `5` | 50 | `true` |
| Assistant Director | `asst_dir` | *(Query or use 6)* | `6` | 40 | `true` |
| Deputy Executive | `deputy` | *(Query or use 7)* | `7` | 30 | `true` |
| Senior Sub Exec | `sr_sub` | *(Query or use 8)* | `8` | 20 | `true` |
| Sub Executive 1 | `sub1` | *(Query or use 9)* | `9` | 10 | `false` |
| Sub Executive 2 | `sub2` | *(Query or use 10)* | `10` | 10 | `false` |
| Dual Member | `dual` | *(Query or use 11)* | `11` | 40 (evaluates highest) | `true` |
| Unranked Member | `unranked` | *(Query or use 12)* | `12` | 0 | `false` |


---

## 4. Curl Examples

All endpoints are hosted at `http://localhost:5001/api/administration/tasks`.

### 4.1 List Eligible Assignees
Fetch members ranked strictly lower than the acting user:
```bash
curl -X GET "http://localhost:5001/api/administration/tasks/eligible-assignees?panel_term_id=1" \
  -H "Content-Type: application/json" \
  -H "x-acting-user-id: 1"
```

### 4.2 List Tasks
```bash
curl -X GET "http://localhost:5001/api/administration/tasks" \
  -H "Content-Type: application/json" \
  -H "x-acting-user-id: 1"
```

### 4.3 Get Single Task
```bash
curl -X GET "http://localhost:5001/api/administration/tasks/1" \
  -H "Content-Type: application/json" \
  -H "x-acting-user-id: 1"
```

### 4.4 Create a Task
```bash
curl -X POST "http://localhost:5001/api/administration/tasks" \
  -H "Content-Type: application/json" \
  -H "x-acting-user-id: 1" \
  -d '{
    "panel_term_id": 1,
    "team_id": 1,
    "task_title": "Design Omnidirectional Chassis",
    "task_description": "Draft CAD models in Fusion 360",
    "priority": "HIGH",
    "due_at": "2026-11-01T18:00:00Z",
    "panel_membership_ids": [5, 6]
  }'
```

### 4.5 Update Task Details
```bash
curl -X PATCH "http://localhost:5001/api/administration/tasks/1" \
  -H "Content-Type: application/json" \
  -H "x-acting-user-id: 1" \
  -d '{
    "task_title": "Updated: Autonomous Navigation Pipeline",
    "priority": "CRITICAL"
  }'
```

### 4.6 Add Assignees to Task
```bash
curl -X POST "http://localhost:5001/api/administration/tasks/1/assignees" \
  -H "Content-Type: application/json" \
  -H "x-acting-user-id: 1" \
  -d '{
    "panel_membership_ids": [6]
  }'
```

### 4.7 Remove Assignee from Task
```bash
curl -X DELETE "http://localhost:5001/api/administration/tasks/1/assignees/6" \
  -H "Content-Type: application/json" \
  -H "x-acting-user-id: 1"
```

### 4.8 Transition Task Status
```bash
curl -X PATCH "http://localhost:5001/api/administration/tasks/1/status" \
  -H "Content-Type: application/json" \
  -H "x-acting-user-id: 1" \
  -d '{
    "to_status": "BLOCKED",
    "reason": "Waiting for hardware delivery"
  }'
```

### 4.9 View Task Status History
```bash
curl -X GET "http://localhost:5001/api/administration/tasks/1/history" \
  -H "Content-Type: application/json" \
  -H "x-acting-user-id: 1"
```

---

## 5. Running Automated Tests

```bash
npm run test:admin-tasks
```
Runs unit, integration, and e2e test suites using Node's native test runner.
