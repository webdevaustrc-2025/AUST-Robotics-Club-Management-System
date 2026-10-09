# AUSTRC Management System — Comprehensive Project Summary

> **Document:** Project Progress & Architecture Summary  
> **Repository:** `AUST-Robotics-Club-Management-System`  
> **Last Updated:** October 2026  
> **Governing Rules:** [`AGENTS.md`](./AGENTS.md), [`README.md`](./README.md)

---

## 1. Executive Summary

The **AUST Robotics Club Management System (AUSTRC Management System)** is a unified, modular web platform designed to streamline two major operational pillars of the club:
1. **Event Management** — Managing end-to-end participant journeys (events, segments, dynamic forms, QR tracking, attendance, results, and certificate generation).
2. **Administration** — Managing internal club operations (recruitment forms, applicant reviews, executive panel terms, member history, multi-assignee task workflows, and bulk communications).

The project is built as a **single React frontend** and a **single Express backend**, backed by a centralized **Neon PostgreSQL** database governed by strict modular boundaries and schema ownership.

---

## 2. Technology Stack & Design System

| Layer | Technologies & Tools |
|---|---|
| **Frontend** | React 19, Vite 8, React Router 6, Tailwind CSS v4, Lucide React |
| **Backend** | Node.js (v20+), Express 4 (ES Modules), CORS, dotenv |
| **Database** | Neon PostgreSQL (connected via `pg` pool) |
| **Architecture** | Modular monorepo with 3 primary sub-domains: Event Management, Administration, Shared Features |
| **Design Identity** | Modern robotics control system aesthetic; dark surfaces (`#0a0d0c`, `#111714`), primary brand colors: Deep AUSTRC Green (`#006838`) & Bright AUSTRC Green (`#39B54A`) |

---

## 3. Architecture & Separation of Concerns

The project enforces strict separation to enable parallel development teams to work without merge conflicts or database contamination:

```text
AUSTRCManagement/
├── src/                          # Global frontend composition (entry, routing, root layouts)
├── server/                       # Root Express application bootstrap & route mounting
├── event-management/             # Event Management module
│   ├── frontend/                 # Pages, components, routes, hooks, services (evt_*)
│   └── backend/                  # Controllers, services, repositories, routes (evt_*)
├── administration/               # Administration module
│   ├── frontend/                 # Pages, components, routes, hooks, services (adm_*)
│   └── backend/                  # Controllers, services, repositories, routes (adm_*)
├── shared-features/              # Reusable cross-module primitives
│   ├── frontend/                 # Auth context, shared UI (AppShell, Button, Modal, DataTable, Badge)
│   └── backend/                  # DB connection pool, RBAC, file storage, email, document engine
└── database/                     # Schema snapshot, changelog, rules, ownership catalogs
```

### Dependency Rules:
- `Event Management` ➔ depends on `Shared Features` (Allowed)
- `Administration` ➔ depends on `Shared Features` (Allowed)
- `Root (src/server)` ➔ composes `Event`, `Administration`, and `Shared` (Allowed)
- `Event Management` ⇄ `Administration` (Strictly **Forbidden**)
- Direct cross-module Foreign Keys between `evt_*` and `adm_*` (Strictly **Forbidden**)

---

## 4. Database Architecture (56 Tables)

The database architecture is documented in [`database/DATABASE_SCHEMA.md`](./database/DATABASE_SCHEMA.md) and [`database/schema/current_schema.sql`](./database/schema/current_schema.sql).

- **Shared / Core (14 Tables):**
  - Identity & RBAC: `core_users`, `core_user_profiles`, `core_members`, `core_roles`, `core_permissions`, `core_role_permissions`, `core_user_roles`.
  - Shared Infrastructure: `infra_files`, `infra_document_templates`, `infra_generated_documents`, `infra_email_templates`, `infra_email_messages`, `infra_email_delivery_attempts`, `infra_audit_logs`.
- **Event Management (20 Tables — `evt_*`):**
  - Events, Segments, Dynamic Forms: `evt_events`, `evt_event_segments`, `evt_registration_fields`, `evt_registration_field_options`, `evt_registration_answers`.
  - Participants & QR Services: `evt_participants`, `evt_registrations`, `evt_registration_segments`, `evt_qr_codes`, `evt_service_types`, `evt_event_services`, `evt_service_usage`.
  - Operations & Results: `evt_event_sessions`, `evt_event_staff`, `evt_attendance`, `evt_results`, `evt_result_revisions`, `evt_notification_events`, `evt_certificate_eligibility`, `evt_certificates`.
- **Administration (22 Tables — `adm_*`):**
  - Dynamic Forms & Reviews: `adm_forms`, `adm_form_fields`, `adm_form_field_options`, `adm_form_submissions`, `adm_form_answers`, `adm_form_answer_options`, `adm_application_reviews`, `adm_application_status_history`.
  - Executive Panels & Teams: `adm_panel_terms`, `adm_positions`, `adm_teams`, `adm_panel_memberships`, `adm_member_certificates`.
  - Communication: `adm_email_campaigns`, `adm_email_campaign_recipients`.
  - Task Operations: `adm_tasks`, `adm_task_assignees`, `adm_task_status_history`, `adm_task_submissions`, `adm_task_submission_files`, `adm_task_submission_reviews`, `adm_task_comments`.

---

## 5. Chronological Implementation History

### Phase I — Project Scaffolding & Core Foundations (Git History up to PR #1)
1. **Brand Assets & Repository Setup:**
   - Established AUSTRC brand assets (`public/austrc-logo.png`, `public/placeholder-avatar.png`).
   - Configured `.gitignore`, `.env.example`, ESLint, Vite, and root package dependencies.
2. **Server & Database Infrastructure:**
   - Bootstrapped Express server (`server/app.js`, `server/server.js`, `server/config/env.js`).
   - Built shared database connection pooling module (`shared-features/backend/database/db.js`).
   - Scaffolded backend controller, service, repository, and route directories for all modules.
3. **Design System & Tokens:**
   - Implemented Tailwind v4 styling with CSS design tokens in `src/styles/design-tokens.css`.
   - Created dark-mode surface palette, motion parameters, and responsive typography scales.
4. **Shared Frontend Component Library:**
   - Developed core atomic components: `Button`, `Modal`, `DataTable`, `Badge`, `Loader`, `Logo`, `ModuleCard`, `ModulePlaceholder`, `PageTransition`, `Reveal`.
   - Built `AppShell` with responsive sidebar navigation, top bar, and route indicators.
5. **Authentication & Routing Setup:**
   - Created mock/JWT-ready `AuthContext`, `Login` page, and route guards (`ProtectedRoute`).
   - Built public `Landing` page and authenticated `Dashboard` workspace.
6. **Module Placeholder Routes & Shell Integration:**
   - Event Management: `EventManagementHome`, `EventList`, `EventDetails`, `Registration`, `Attendance`, `ResultManagement`, `Certificate`, `ParticipantPortal`.
   - Administration: `AdministrationHome`, `FormManagement`, `ApplicationReview`, `PanelManagement`, `MemberManagement`, `TaskManagement`, `BulkEmail`.

---

### Phase II — Administration Tasks 8 & 9 (Current Active Development)

Assigned to **Senior-Sub-Executive-2** per `Administration_Team_Plan.pdf` and governed by [`plan.md`](./plan.md).

#### Task 8: Task Creation & Multi-Assignee Assignment (Frontend Complete)
- **Dummy API Layer (`tasksApi.js`):**
  - Fully mirrors PostgreSQL tables `adm_tasks` and `adm_task_assignees`.
  - Methods: `listTasks`, `getTask`, `createTask`, `updateTask`, `deleteTask`, `assignMembers`, `unassignMember`, `listEligibleAssignees`.
- **Custom Hooks (`useTasks.js`, `useTaskAssignees.js`):**
  - Manages task listing, searching, client-side filtering (by team, status, priority), and real-time deletion.
  - Manages assignee assignment/unassignment state.
- **Assignee Selector (`AssigneeSelector.jsx`):**
  - Searchable multi-selection component linking directly to `panel_membership_id`.
  - Renders member names, student IDs, team tags, and position badges.
- **Task Form Modal (`TaskFormModal.jsx`):**
  - Handles task creation and edits with validation for required fields, priority, team, due date, and multi-assignees.
- **Task Detail Modal (`TaskDetailModal.jsx`):**
  - Complete task view with status & priority badges, assigner details, due dates, assignee chip listing, add/remove assignee controls, and task deletion with confirmation.
- **Task Management Page (`TaskManagement.jsx`):**
  - Redesigned into an interactive task hub featuring KPI metric cards, filters, search, and a `DataTable` with quick actions.
- **Navigation & Routing:**
  - Mounted `/tasks` and `/administration/tasks` in `administrationRoutes.jsx`.
  - Wired direct links from `AdministrationHome.jsx` and updated `AppShell.jsx` for active state detection.

#### Task 9: Task Status Workflow & Progress History (Core Frontend Complete)
- **Strict Status Contract:**
  - Supported statuses restricted strictly to `TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE`.
- **Status Transition Modal (`StatusTransitionModal.jsx`):**
  - Prevents invalid transitions and strictly enforces a mandatory reason when moving to `BLOCKED`.
- **Task Status Timeline (`TaskStatusTimeline.jsx`):**
  - Chronological audit trail showing status transitions (`from_status` ➔ `to_status`), who made the change, timestamp, and block/transition reasons.
- **Integration:**
  - Integrated quick status transitions and history popups directly into `TaskManagement.jsx` table rows and `TaskDetailModal.jsx`.

---

## 6. Current Repository Status & Next Steps

### Current Working Tree State
- **Unstaged modified files:**
  - `administration/frontend/pages/AdministrationHome.jsx`
  - `administration/frontend/pages/TaskManagement.jsx`
  - `administration/frontend/routes/administrationRoutes.jsx`
  - `shared-features/frontend/components/AppShell.jsx`
  - `shared-features/frontend/components/Button.jsx`
  - `shared-features/frontend/components/ModulePlaceholder.jsx`
- **Untracked files:**
  - `administration/frontend/components/AssigneeSelector.jsx`
  - `administration/frontend/components/StatusTransitionModal.jsx`
  - `administration/frontend/components/TaskDetailModal.jsx`
  - `administration/frontend/components/TaskFormModal.jsx`
  - `administration/frontend/components/TaskStatusTimeline.jsx`
  - `administration/frontend/hooks/useTaskAssignees.js`
  - `administration/frontend/hooks/useTasks.js`
  - `administration/frontend/services/tasksApi.js`
  - `plan.md`

### Roadmap & Next Planned Tasks (from `plan.md`)
1. **Frontend Polish:**
   - Implement `TaskBoardView.jsx` (Kanban column view for `TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE`).
2. **Backend Implementation (Task 8 & 9):**
   - Repositories: `taskRepository.js`, `taskAssigneeRepository.js`, and append-only `taskStatusHistoryRepository.js`.
   - Services & Validators: `taskService.js`, `taskStatusService.js`, `taskValidator.js`.
   - Controllers & Routes: mounted under `/api/administration/tasks` with auth and role verification.
3. **Connect Phase:**
   - Swap dummy in-memory calls in `tasksApi.js` with real HTTP calls via `apiClient.js`.
4. **Validation:**
   - End-to-end verification and running `npm run lint` / `npm run build`.
