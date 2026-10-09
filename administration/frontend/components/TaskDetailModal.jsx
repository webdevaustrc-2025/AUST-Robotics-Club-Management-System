import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Calendar,
  Clock,
  Edit3,
  History,
  RefreshCw,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import Badge from '../../../shared-features/frontend/components/Badge.jsx'
import Button from '../../../shared-features/frontend/components/Button.jsx'
import Modal from '../../../shared-features/frontend/components/Modal.jsx'
import { assignMembers, unassignMember } from '../services/tasksApi.js'
import AssigneeSelector from './AssigneeSelector.jsx'
import StatusTransitionModal from './StatusTransitionModal.jsx'
import TaskStatusTimeline from './TaskStatusTimeline.jsx'
import ConfirmDeleteModal from './ConfirmDeleteModal.jsx'

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
  return `Due in ${diffDays} days`
}

function formatDateTime(dateString) {
  if (!dateString) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString))
}

const PRIORITY_BADGES = {
  CRITICAL: { variant: 'danger', label: 'Critical' },
  HIGH: { variant: 'warning', label: 'High' },
  MEDIUM: { variant: 'info', label: 'Medium' },
  LOW: { variant: 'neutral', label: 'Low' },
}

const STATUS_BADGES = {
  TODO: { variant: 'neutral', label: 'To Do' },
  IN_PROGRESS: { variant: 'info', label: 'In Progress', dot: true, pulse: true },
  BLOCKED: { variant: 'danger', label: 'Blocked', dot: true },
  DONE: { variant: 'success', label: 'Done', dot: true },
}

function TaskDetailModal({
  task,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onTaskUpdated,
  eligibleMembers = [],
}) {
  const [showAddAssignee, setShowAddAssignee] = useState(false)
  const [selectedToAdd, setSelectedToAdd] = useState([])
  const [submittingAssignee, setSubmittingAssignee] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [assigneeRejectionReasons, setAssigneeRejectionReasons] = useState(null)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0)

  // Current assigned membership IDs to filter them out of addition pool
  const currentAssignedIds = useMemo(() => {
    return (task?.assignees || []).map((a) => String(a.panel_membership_id))
  }, [task?.assignees])

  // Filter available members who are not yet assigned
  const availableToAdd = useMemo(() => {
    return eligibleMembers.filter(
      (m) => !currentAssignedIds.includes(String(m.panel_membership_id))
    )
  }, [eligibleMembers, currentAssignedIds])

  if (!task) return null

  const priorityConfig = PRIORITY_BADGES[task.priority] || PRIORITY_BADGES.MEDIUM
  const statusConfig = STATUS_BADGES[task.status] || STATUS_BADGES.TODO

  const isOverdue =
    task.status !== 'DONE' && task.due_at && new Date(task.due_at) < new Date()

  const handleDelete = async () => {
    if (!onDelete) return
    setIsDeleting(true)
    setActionError(null)
    try {
      await onDelete(task)
      onClose()
    } catch (err) {
      setActionError(err.message || 'Failed to delete task')
      setIsDeleting(false)
    }
  }

  const handleUnassign = async (panelMembershipId) => {
    setActionError(null)
    try {
      const updated = await unassignMember(task.task_id, panelMembershipId)
      onTaskUpdated(updated)
    } catch (err) {
      setActionError(err.message || 'Failed to remove assignee')
    }
  }

  const handleAddAssignees = async () => {
    if (!selectedToAdd.length) return
    setSubmittingAssignee(true)
    setActionError(null)
    setAssigneeRejectionReasons(null)
    try {
      const updated = await assignMembers(task.task_id, selectedToAdd)
      onTaskUpdated(updated)
      setSelectedToAdd([])
      setShowAddAssignee(false)
    } catch (err) {
      setActionError(err.message || 'Failed to add assignees')
      if (err.details) {
        setAssigneeRejectionReasons(err.details)
      }
    } finally {
      setSubmittingAssignee(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Task Specification & Assignment">
      <div className="flex flex-col gap-5">
        {actionError && (
          <div className="rounded-sm border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
            {actionError}
          </div>
        )}

        {/* Header Badges & Title */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-brand-400 uppercase tracking-wider">
              {task.team_name}
            </span>
            <span className="text-subtle">•</span>
            <Badge variant={priorityConfig.variant}>{priorityConfig.label}</Badge>
            <Badge
              variant={statusConfig.variant}
              dot={statusConfig.dot}
              pulse={statusConfig.pulse}
            >
              {statusConfig.label}
            </Badge>
            <button
              type="button"
              onClick={() => setStatusModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-sm border border-edge bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-brand-400 transition-colors hover:border-brand-500 hover:text-brand-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-400"
            >
              <RefreshCw size={11} className="shrink-0" />
              Change Status
            </button>
          </div>
          <h1 className="text-lg font-semibold text-ink sm:text-xl">{task.task_title}</h1>
        </div>

        {/* Blocked Reason Alert if task is blocked */}
        {task.status === 'BLOCKED' && task.blocked_reason && (
          <div className="flex items-start gap-2.5 rounded-sm border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Blocked: </span>
              {task.blocked_reason}
            </div>
          </div>
        )}

        {/* Description */}
        <div className="flex flex-col gap-1.5 rounded-sm border border-edge-subtle bg-surface-1 p-3.5">
          <span className="font-mono text-xs uppercase tracking-[0.1em] text-subtle">
            Specification / Deliverable Scope
          </span>
          <p className="whitespace-pre-wrap text-sm text-muted">
            {task.task_description || 'No detailed description provided.'}
          </p>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Target Due */}
          <div className="flex flex-col gap-1 rounded-sm border border-edge bg-surface-1 p-3">
            <div className="flex items-center gap-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-subtle">
              <Clock size={13} className="text-muted" />
              Target Due
            </div>
            <span
              className={`text-xs font-semibold ${
                isOverdue ? 'text-danger font-bold' : 'text-ink'
              }`}
            >
              {formatRelativeTime(task.due_at)}
            </span>
            <span className="font-mono text-[0.625rem] text-faint">
              {formatDateTime(task.due_at)}
            </span>
          </div>

          {/* Assigned By */}
          <div className="flex flex-col gap-1 rounded-sm border border-edge bg-surface-1 p-3">
            <div className="flex items-center gap-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-subtle">
              <Shield size={13} className="text-muted" />
              Assigner Role
            </div>
            <span className="truncate text-xs font-medium text-ink">
              {task.assigner_name}
            </span>
            <span className="font-mono text-[0.625rem] text-subtle">
              {task.assigner_position}
            </span>
          </div>

          {/* Created Date */}
          <div className="flex flex-col gap-1 rounded-sm border border-edge bg-surface-1 p-3">
            <div className="flex items-center gap-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-subtle">
              <Calendar size={13} className="text-muted" />
              Logged
            </div>
            <span className="text-xs text-muted">{formatDateTime(task.created_at)}</span>
            {task.completed_at && (
              <span className="font-mono text-[0.625rem] text-brand-400">
                Completed: {formatDateTime(task.completed_at)}
              </span>
            )}
          </div>
        </div>

        {/* Assigned Panel Members Section */}
        <div className="flex flex-col gap-3 border-t border-edge-subtle pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-brand-400" />
              <h3 className="font-mono text-xs uppercase tracking-[0.1em] text-subtle">
                Assigned Panel Members ({task.assignees?.length || 0})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowAddAssignee(!showAddAssignee)}
              className="inline-flex items-center gap-1.5 font-mono text-xs text-brand-400 hover:text-brand-300 transition-colors"
            >
              <UserPlus size={13} />
              {showAddAssignee ? 'Cancel' : 'Add Assignee'}
            </button>
          </div>

          {/* Inline Add Assignees Box */}
          {showAddAssignee && (
            <div className="flex flex-col gap-3 rounded-sm border border-brand-500/30 bg-surface-1 p-3">
              <AssigneeSelector
                selectedIds={selectedToAdd}
                onChange={(ids) => {
                  setSelectedToAdd(ids)
                  if (assigneeRejectionReasons) setAssigneeRejectionReasons(null)
                }}
                eligibleMembers={availableToAdd}
                label="Select Panel Members to Assign"
                helperText="Members will be added with ASSIGNED status in adm_task_assignees."
                rejectionReasons={assigneeRejectionReasons}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setShowAddAssignee(false)
                    setSelectedToAdd([])
                    setAssigneeRejectionReasons(null)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={!selectedToAdd.length}
                  loading={submittingAssignee}
                  onClick={handleAddAssignees}
                >
                  Confirm Assignment
                </Button>
              </div>
            </div>
          )}

          {/* Current Assignees List */}
          {!task.assignees || task.assignees.length === 0 ? (
            <div className="rounded-sm border border-dashed border-edge bg-surface-1 p-4 text-center text-xs text-subtle">
              No panel members currently assigned to this task.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {task.assignees.map((assignee) => (
                <div
                  key={assignee.task_assignee_id}
                  className="flex items-center justify-between rounded-sm border border-edge bg-surface-1 p-2.5 transition-colors hover:bg-surface-2"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="grid size-8 place-items-center rounded-full bg-linear-135 from-brand-500 to-brand-700 font-display text-xs font-bold text-[#04170c]"
                      aria-hidden="true"
                    >
                      {initialsOf(assignee.member_name)}
                    </span>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-ink">
                          {assignee.member_name}
                        </span>
                        <span className="font-mono text-[0.6875rem] text-subtle">
                          {assignee.student_id}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[0.6875rem] text-muted">
                        <span>{assignee.position_title}</span>
                        <span className="text-subtle">•</span>
                        <span className="text-subtle">{assignee.team_name}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={assignee.status === 'COMPLETED' ? 'success' : 'neutral'}>
                      {assignee.status}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => handleUnassign(assignee.panel_membership_id)}
                      title="Unassign member"
                      className="grid size-8 place-items-center rounded-sm text-subtle transition-colors hover:bg-surface-hover hover:text-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Progress & Status History Section */}
        <div className="flex flex-col gap-3 border-t border-edge-subtle pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History size={16} className="text-brand-400" />
              <h2 className="text-sm font-semibold text-ink">Progress & Status History</h2>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory((prev) => !prev)}
            >
              {showHistory ? 'Hide Timeline' : 'View Timeline'}
            </Button>
          </div>
          {showHistory && (
            <div className="rounded-sm border border-edge bg-surface-1 p-4">
              <TaskStatusTimeline taskId={task.task_id} refreshTrigger={historyRefreshTrigger} />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-edge-subtle pt-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setStatusModalOpen(true)}
            >
              <RefreshCw size={14} />
              Change Status
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                onClose()
                onEdit(task)
              }}
            >
              <Edit3 size={14} />
              Edit Configuration
            </Button>

            {onDelete && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={14} />
                Delete Task
              </Button>
            )}
          </div>

          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      <StatusTransitionModal
        task={task}
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        onStatusChanged={(updatedTask) => {
          onTaskUpdated(updatedTask)
          setHistoryRefreshTrigger((prev) => prev + 1)
        }}
      />

      <ConfirmDeleteModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        task={task}
        loading={isDeleting}
      />
    </Modal>
  )
}

export default TaskDetailModal
