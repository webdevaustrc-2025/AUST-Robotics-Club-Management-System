import { useMemo, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Eye,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react'
import Badge from '../../../shared-features/frontend/components/Badge.jsx'
import Button from '../../../shared-features/frontend/components/Button.jsx'
import DataTable from '../../../shared-features/frontend/components/DataTable.jsx'
import Loader from '../../../shared-features/frontend/components/Loader.jsx'
import StatusTransitionModal from '../components/StatusTransitionModal.jsx'
import TaskDetailModal from '../components/TaskDetailModal.jsx'
import TaskFormModal from '../components/TaskFormModal.jsx'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal.jsx'
import { useTaskAssignees } from '../hooks/useTaskAssignees.js'
import { useTasks } from '../hooks/useTasks.js'

function initialsOf(name) {
  if (!name) return 'MB'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatRelativeTime(dateString) {
  if (!dateString) return 'No due date'
  const target = new Date(dateString)
  const now = new Date()
  const diffMs = target - now
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`
  if (diffDays === 0) return 'Due today'
  if (diffDays === 1) return 'Due tomorrow'
  return `Due in ${diffDays}d`
}

function formatShortDate(dateString) {
  if (!dateString) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(dateString))
}

const PRIORITY_CONFIGS = {
  CRITICAL: { variant: 'danger', label: 'Critical' },
  HIGH: { variant: 'warning', label: 'High' },
  MEDIUM: { variant: 'info', label: 'Medium' },
  LOW: { variant: 'neutral', label: 'Low' },
}

const STATUS_CONFIGS = {
  TODO: { variant: 'neutral', label: 'To Do' },
  IN_PROGRESS: { variant: 'info', label: 'In Progress', dot: true, pulse: true },
  BLOCKED: { variant: 'danger', label: 'Blocked', dot: true },
  DONE: { variant: 'success', label: 'Done', dot: true },
}

function TaskManagement() {
  const {
    tasks,
    teams,
    panelTerms,
    loading,
    error,
    filters,
    setFilters,
    reloadTasks,
    createTask,
    updateTask,
    deleteTask,
  } = useTasks()

  const { eligibleMembers, reloadEligible } = useTaskAssignees()

  // Modal states
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [statusTargetTask, setStatusTargetTask] = useState(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Calculate high-level summary metrics
  const stats = useMemo(() => {
    const total = tasks.length
    const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS').length
    const blocked = tasks.filter((t) => t.status === 'BLOCKED').length
    const done = tasks.filter((t) => t.status === 'DONE').length
    const overdue = tasks.filter(
      (t) => t.status !== 'DONE' && t.due_at && new Date(t.due_at) < new Date()
    ).length
    return { total, inProgress, blocked, done, overdue }
  }, [tasks])

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingTask(null)
    setFormModalOpen(true)
  }

  // Open Edit Modal
  const handleOpenEdit = (task) => {
    setEditingTask(task)
    setFormModalOpen(true)
  }

  // Open Detail Modal
  const handleOpenDetail = (task) => {
    setSelectedTask(task)
    setDetailModalOpen(true)
  }

  // Open Status Change Modal
  const handleOpenStatusModal = (task) => {
    setStatusTargetTask(task)
    setStatusModalOpen(true)
  }

  // Open Delete Confirmation Modal
  const handleOpenDeleteConfirm = (task) => {
    setTaskToDelete(task)
    setDeleteModalOpen(true)
  }

  // Save task (create or update)
  const handleFormSubmit = async (payload) => {
    if (editingTask) {
      const updated = await updateTask(editingTask.task_id, payload)
      if (selectedTask?.task_id === editingTask.task_id) {
        setSelectedTask(updated)
      }
    } else {
      await createTask(payload)
    }
  }

  // Handle task updated inside detail modal (assign/unassign)
  const handleTaskUpdatedInDetail = (updatedTask) => {
    setSelectedTask(updatedTask)
    reloadTasks()
    reloadEligible()
  }

  // Delete task
  const handleDeleteTask = async (task) => {
    await deleteTask(task.task_id)
    if (selectedTask?.task_id === task.task_id) {
      setSelectedTask(null)
      setDetailModalOpen(false)
    }
    reloadEligible()
  }

  // Confirm delete handler from modal
  const handleConfirmDelete = async () => {
    if (!taskToDelete) return
    setIsDeleting(true)
    try {
      await handleDeleteTask(taskToDelete)
      setDeleteModalOpen(false)
      setTaskToDelete(null)
    } catch (err) {
      console.error('Failed to delete task:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  // Reset filters
  const handleResetFilters = () => {
    setFilters({
      team_id: 'ALL',
      status: 'ALL',
      priority: 'ALL',
      search: '',
    })
  }

  const hasActiveFilters =
    filters.team_id !== 'ALL' ||
    filters.status !== 'ALL' ||
    filters.priority !== 'ALL' ||
    Boolean(filters.search)

  // Columns definition for shared DataTable
  const tableColumns = [
    {
      key: 'task_title',
      header: 'Task Specification',
      render: (task) => {
        return (
          <div className="flex flex-col gap-1 py-1 max-w-sm sm:max-w-md">
            <button
              type="button"
              onClick={() => handleOpenDetail(task)}
              className="text-left font-medium text-ink hover:text-brand-400 transition-colors line-clamp-1"
            >
              {task.task_title}
            </button>
            {task.task_description && (
              <p className="line-clamp-1 text-xs text-subtle">{task.task_description}</p>
            )}
            {task.status === 'BLOCKED' && task.blocked_reason && (
              <span className="flex items-center gap-1 text-[0.6875rem] text-danger">
                <AlertTriangle size={12} className="shrink-0" />
                <span className="truncate">Blocked: {task.blocked_reason}</span>
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'team_name',
      header: 'Team',
      render: (task) => (
        <span className="font-mono text-xs text-muted">
          {task.team_name}
        </span>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (task) => {
        const p = PRIORITY_CONFIGS[task.priority] || PRIORITY_CONFIGS.MEDIUM
        return <Badge variant={p.variant}>{p.label}</Badge>
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (task) => {
        const s = STATUS_CONFIGS[task.status] || STATUS_CONFIGS.TODO
        return (
          <button
            type="button"
            onClick={() => handleOpenStatusModal(task)}
            title="Click to change status"
            className="group inline-flex items-center gap-1.5 rounded-sm p-0.5 text-left transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-400"
          >
            <Badge variant={s.variant} dot={s.dot} pulse={s.pulse}>
              {s.label}
            </Badge>
            <RefreshCw size={11} className="text-subtle opacity-0 transition-opacity group-hover:opacity-100 group-hover:text-brand-400" />
          </button>
        )
      },
    },
    {
      key: 'assignees',
      header: 'Assigned Members',
      render: (task) => {
        const count = task.assignees?.length || 0
        if (count === 0) {
          return <span className="font-mono text-xs text-faint">Unassigned</span>
        }

        const visible = task.assignees.slice(0, 3)
        const overflow = count - visible.length

        return (
          <div className="flex items-center gap-1.5" title={task.assignees.map((a) => a.member_name).join(', ')}>
            <div className="flex -space-x-2 overflow-hidden">
              {visible.map((a) => (
                <span
                  key={a.task_assignee_id}
                  className="grid size-7 place-items-center rounded-full border border-surface-2 bg-linear-135 from-brand-500 to-brand-700 font-display text-[0.625rem] font-bold text-[#04170c]"
                  title={`${a.member_name} (${a.position_title})`}
                >
                  {initialsOf(a.member_name)}
                </span>
              ))}
            </div>
            {overflow > 0 && (
              <span className="font-mono text-xs text-subtle">+{overflow}</span>
            )}
          </div>
        )
      },
    },
    {
      key: 'due_at',
      header: 'Target Due',
      render: (task) => {
        if (!task.due_at) {
          return <span className="font-mono text-xs text-faint">None</span>
        }
        const isOverdue =
          task.status !== 'DONE' && new Date(task.due_at) < new Date()
        return (
          <div className="flex flex-col font-mono text-xs">
            <span className={isOverdue ? 'font-semibold text-danger' : 'text-ink'}>
              {formatRelativeTime(task.due_at)}
            </span>
            <span className="text-[0.625rem] text-faint">
              {formatShortDate(task.due_at)}
            </span>
          </div>
        )
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (task) => (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleOpenStatusModal(task)}
            title="Change status"
            className="inline-flex items-center gap-1 rounded-sm border border-edge bg-surface-2 px-2 py-1 text-xs font-medium text-brand-400 transition-colors hover:border-brand-500 hover:text-brand-300"
          >
            <RefreshCw size={11} />
            Status
          </button>
          <button
            type="button"
            onClick={() => handleOpenDetail(task)}
            className="inline-flex items-center gap-1 rounded-sm border border-edge bg-surface-2 px-2.5 py-1 text-xs text-ink transition-colors hover:border-brand-500 hover:text-brand-300"
          >
            <Eye size={12} />
            Inspect
          </button>
          <button
            type="button"
            onClick={() => handleOpenDeleteConfirm(task)}
            title="Delete task"
            className="grid size-7 place-items-center rounded-sm border border-edge bg-surface-2 text-subtle transition-colors hover:border-danger hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ),
    },
  ]

  // Convert tasks to rows format expected by DataTable
  const tableRows = useMemo(() => {
    return tasks.map((t) => ({
      id: t.task_id,
      ...t,
    }))
  }, [tasks])

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-[0.14em] text-faint">
              Administration / Operations
            </span>
            <span className="text-subtle">•</span>
            <span className="font-mono text-xs text-brand-400">
              {panelTerms[0]?.term_name || 'Current Term'}
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Task Management & Assignment
          </h1>
          <p className="text-sm text-muted">
            Coordinate executive club workflows, delegate responsibilities, and monitor progress across sub-committees.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
          <Button variant="primary" size="md" onClick={handleOpenCreate}>
            <Plus size={18} strokeWidth={2.5} />
            <span>New Task</span>
          </Button>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* Total */}
        <div className="flex flex-col gap-1 rounded-sm border border-edge bg-surface-1 p-3.5 transition-colors hover:border-edge-strong">
          <span className="font-mono text-xs uppercase tracking-[0.1em] text-subtle">
            Total Tasks
          </span>
          <span className="font-display text-2xl font-bold text-ink">{stats.total}</span>
          <span className="text-[0.6875rem] text-faint">Active & historical scope</span>
        </div>

        {/* In Progress */}
        <div className="flex flex-col gap-1 rounded-sm border border-edge bg-surface-1 p-3.5 transition-colors hover:border-brand-500/40">
          <span className="font-mono text-xs uppercase tracking-[0.1em] text-brand-300">
            In Progress
          </span>
          <span className="font-display text-2xl font-bold text-brand-400">
            {stats.inProgress}
          </span>
          <span className="text-[0.6875rem] text-faint">Active member execution</span>
        </div>

        {/* Blocked */}
        <div className="flex flex-col gap-1 rounded-sm border border-edge bg-surface-1 p-3.5 transition-colors hover:border-danger/40">
          <span className="font-mono text-xs uppercase tracking-[0.1em] text-danger">
            Blocked
          </span>
          <span className="font-display text-2xl font-bold text-danger">{stats.blocked}</span>
          <span className="text-[0.6875rem] text-faint">Requires director intervention</span>
        </div>

        {/* Done */}
        <div className="flex flex-col gap-1 rounded-sm border border-edge bg-surface-1 p-3.5 transition-colors hover:border-brand-500/40">
          <span className="font-mono text-xs uppercase tracking-[0.1em] text-subtle">
            Completed
          </span>
          <span className="font-display text-2xl font-bold text-ink">{stats.done}</span>
          <span className="text-[0.6875rem] text-faint">Delivered and closed</span>
        </div>

        {/* Overdue */}
        <div className="flex flex-col gap-1 rounded-sm border border-edge bg-surface-1 p-3.5 transition-colors hover:border-warning/40">
          <span className="font-mono text-xs uppercase tracking-[0.1em] text-warning">
            Overdue
          </span>
          <span className="font-display text-2xl font-bold text-warning">{stats.overdue}</span>
          <span className="text-[0.6875rem] text-faint">Past target timeline</span>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col gap-3 rounded-md border border-edge bg-surface-1 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle"
            />
            <input
              type="text"
              placeholder="Search tasks by title, deliverable keywords, or details..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full rounded-sm border border-edge bg-surface-2 py-2 pl-9 pr-3 text-sm text-ink placeholder:text-subtle transition-colors focus:border-brand-500 focus:outline-none"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Team Filter */}
            <select
              value={filters.team_id}
              onChange={(e) => setFilters({ ...filters, team_id: e.target.value })}
              className="h-9 rounded-sm border border-edge bg-surface-2 px-3 text-xs text-ink transition-colors focus:border-brand-500 focus:outline-none"
            >
              <option value="ALL">All Teams</option>
              {teams.map((t) => (
                <option key={t.team_id} value={t.team_id} className="bg-surface-2 text-ink">
                  {t.team_name}
                </option>
              ))}
            </select>

            {/* Priority Filter */}
            <select
              value={filters.priority}
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
              className="h-9 rounded-sm border border-edge bg-surface-2 px-3 text-xs text-ink transition-colors focus:border-brand-500 focus:outline-none"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            {/* Status Filter */}
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="h-9 rounded-sm border border-edge bg-surface-2 px-3 text-xs text-ink transition-colors focus:border-brand-500 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="BLOCKED">Blocked</option>
              <option value="DONE">Done</option>
            </select>

            {/* Reset Filters */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-edge-subtle bg-surface-2 px-2.5 text-xs text-subtle transition-colors hover:text-ink"
              >
                <RotateCcw size={12} />
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-md border border-edge bg-surface-1">
          <Loader label="Synchronizing task database..." />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-danger/30 bg-surface-1 p-8 text-center">
          <AlertCircle size={28} className="text-danger" />
          <p className="text-sm text-danger">{error}</p>
          <Button variant="secondary" size="sm" onClick={reloadTasks}>
            Retry Sync
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <span className="font-mono text-xs text-subtle">
              Showing {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
            </span>
          </div>

          <DataTable
            columns={tableColumns}
            rows={tableRows}
            emptyMessage="No tasks found matching your filter criteria. Try resetting filters or create a new task."
          />
        </div>
      )}

      {/* Modals */}
      <TaskFormModal
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        onSubmit={handleFormSubmit}
        initialData={editingTask}
        teams={teams}
        panelTerms={panelTerms}
        eligibleMembers={eligibleMembers}
      />

      <TaskDetailModal
        task={selectedTask}
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        onEdit={(task) => {
          setDetailModalOpen(false)
          handleOpenEdit(task)
        }}
        onDelete={handleDeleteTask}
        onTaskUpdated={handleTaskUpdatedInDetail}
        eligibleMembers={eligibleMembers}
      />

      <StatusTransitionModal
        task={statusTargetTask}
        isOpen={statusModalOpen}
        onClose={() => {
          setStatusModalOpen(false)
          setStatusTargetTask(null)
        }}
        onStatusChanged={(updatedTask) => {
          reloadTasks()
          if (selectedTask?.task_id === updatedTask.task_id) {
            setSelectedTask(updatedTask)
          }
        }}
      />

      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false)
          setTaskToDelete(null)
        }}
        onConfirm={handleConfirmDelete}
        task={taskToDelete}
        loading={isDeleting}
      />
    </div>
  )
}

export default TaskManagement
