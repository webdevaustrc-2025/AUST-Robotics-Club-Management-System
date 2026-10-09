import { useEffect, useState } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, PlayCircle } from 'lucide-react'
import Badge from '../../../shared-features/frontend/components/Badge.jsx'
import Button from '../../../shared-features/frontend/components/Button.jsx'
import Modal from '../../../shared-features/frontend/components/Modal.jsx'
import { transitionTaskStatus } from '../services/tasksApi.js'

const STATUS_OPTIONS = [
  {
    key: 'TODO',
    label: 'To Do',
    description: 'Work has not begun or is queued',
    variant: 'neutral',
    icon: Clock,
  },
  {
    key: 'IN_PROGRESS',
    label: 'In Progress',
    description: 'Actively being executed by assigned members',
    variant: 'info',
    icon: PlayCircle,
    pulse: true,
  },
  {
    key: 'BLOCKED',
    label: 'Blocked',
    description: 'Impediment encountered; requires a reason',
    variant: 'danger',
    icon: AlertTriangle,
  },
  {
    key: 'DONE',
    label: 'Done',
    description: 'Completed and ready for review/signoff',
    variant: 'success',
    icon: CheckCircle2,
    dot: true,
  },
]

function StatusTransitionModal({ task, isOpen, onClose, onStatusChanged }) {
  const [selectedStatus, setSelectedStatus] = useState(task?.status || 'TODO')
  const [reason, setReason] = useState(task?.blocked_reason || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (task) {
      setSelectedStatus(task.status)
      setReason(task.status === 'BLOCKED' ? task.blocked_reason || '' : '')
      setError(null)
    }
  }, [task, isOpen])

  if (!task) return null

  const isBlocked = selectedStatus === 'BLOCKED'
  const isUnchanged = selectedStatus === task.status && (!isBlocked || reason === (task.blocked_reason || ''))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (isBlocked && (!reason || !reason.trim())) {
      setError('Please provide a reason explaining what is blocking this task.')
      return
    }

    setSubmitting(true)
    try {
      const result = await transitionTaskStatus(task.task_id, {
        to_status: selectedStatus,
        reason: reason.trim(),
      })
      if (onStatusChanged) {
        onStatusChanged(result.task)
      }
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to update task status')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} title="Change Task Status" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {error && (
          <div className="flex items-center gap-2 rounded-sm border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <span className="font-mono text-xs uppercase tracking-[0.1em] text-faint">
            Target Task
          </span>
          <h3 className="mt-0.5 text-sm font-semibold text-ink line-clamp-1">
            {task.task_title}
          </h3>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-xs text-subtle">Current status:</span>
            <Badge
              variant={
                STATUS_OPTIONS.find((s) => s.key === task.status)?.variant || 'neutral'
              }
              dot
            >
              {STATUS_OPTIONS.find((s) => s.key === task.status)?.label || task.status}
            </Badge>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-mono text-xs uppercase tracking-[0.1em] text-subtle">
            Select New Status
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {STATUS_OPTIONS.map((opt) => {
              const Icon = opt.icon
              const isSelected = selectedStatus === opt.key
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    setSelectedStatus(opt.key)
                    if (opt.key !== 'BLOCKED' && selectedStatus === 'BLOCKED') {
                      setError(null)
                    }
                  }}
                  className={`flex flex-col items-start gap-1.5 rounded-md border p-3 text-left transition-all ${
                    isSelected
                      ? 'border-brand-500 bg-brand-500/10 shadow-glow-subtle ring-1 ring-brand-500/40'
                      : 'border-edge bg-surface-1 hover:border-edge-strong hover:bg-surface-hover'
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <Badge variant={opt.variant} dot={opt.dot} pulse={opt.pulse}>
                      <Icon size={12} className="mr-1 inline-block" />
                      {opt.label}
                    </Badge>
                    {isSelected && (
                      <span className="font-mono text-[0.625rem] text-brand-400 font-bold uppercase tracking-widest">
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="text-[0.75rem] text-subtle leading-tight">
                    {opt.description}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {isBlocked && (
          <div className="flex flex-col gap-1.5 animate-fade-in">
            <label
              htmlFor="blocked_reason"
              className="flex items-center justify-between font-mono text-xs uppercase tracking-[0.1em] text-subtle"
            >
              <span>Reason for Blocker *</span>
              <span className="text-[0.6875rem] text-danger">Mandatory</span>
            </label>
            <textarea
              id="blocked_reason"
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="E.g. Awaiting part delivery from vendor, waiting on PCB fabrication..."
              className="rounded-sm border border-danger/40 bg-surface-1 p-2.5 text-xs text-ink placeholder:text-faint focus:border-danger focus:outline-none focus:ring-1 focus:ring-danger"
            />
          </div>
        )}

        {!isBlocked && selectedStatus !== task.status && (
          <div className="flex flex-col gap-1.5 animate-fade-in">
            <label
              htmlFor="transition_note"
              className="font-mono text-xs uppercase tracking-[0.1em] text-subtle"
            >
              Status Transition Note (Optional)
            </label>
            <input
              id="transition_note"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="E.g. Completed initial code review and passing tests"
              className="rounded-sm border border-edge bg-surface-1 p-2.5 text-xs text-ink placeholder:text-faint focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-edge-subtle pt-4">
          <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            loading={submitting}
            disabled={submitting || (isUnchanged && !isBlocked)}
          >
            Confirm Status Change
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default StatusTransitionModal
