import { AlertTriangle } from 'lucide-react'
import Button from '../../../shared-features/frontend/components/Button.jsx'
import Modal from '../../../shared-features/frontend/components/Modal.jsx'

/**
 * ConfirmDeleteModal — Accessible, styled deletion confirmation dialog
 * replacing native browser window.confirm / alert.
 */
function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  task = null,
  loading = false,
}) {
  if (!task) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirm Task Deletion">
      <div className="flex flex-col gap-4">
        {/* Warning Banner */}
        <div className="flex items-start gap-3 rounded-sm border border-danger/30 bg-danger/10 p-3.5">
          <div className="grid size-9 shrink-0 place-items-center rounded-sm bg-danger/20 text-danger">
            <AlertTriangle size={18} />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-ink">
              Delete "{task.task_title}"?
            </h3>
            <p className="text-xs text-muted">
              Are you sure you want to delete this task? This action will permanently remove the task record and all associated assignee relationships.
            </p>
          </div>
        </div>

        {/* Task Summary Box */}
        <div className="rounded-sm border border-edge-subtle bg-surface-1 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-subtle">
              Task ID #{task.task_id}
            </span>
            <span className="font-mono text-[0.6875rem] text-brand-400">
              {task.team_name || 'AUSTRC'}
            </span>
          </div>
          <p className="mt-1 font-medium text-ink">
            {task.task_title}
          </p>
          {task.assignees && task.assignees.length > 0 && (
            <p className="mt-2 text-[0.6875rem] text-subtle">
              Currently assigned to: {task.assignees.map((a) => a.member_name).join(', ')}
            </p>
          )}
        </div>

        <p className="text-xs text-subtle">
          This operation cannot be undone. In a live system, tasks can only be removed by authorized panel members.
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 border-t border-edge-subtle pt-4">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={loading}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            loading={loading}
            onClick={onConfirm}
          >
            Delete Task
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default ConfirmDeleteModal
