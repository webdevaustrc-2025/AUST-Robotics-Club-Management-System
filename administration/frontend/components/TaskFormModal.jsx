import { useState } from 'react'
import Button from '../../../shared-features/frontend/components/Button.jsx'
import Modal from '../../../shared-features/frontend/components/Modal.jsx'
import AssigneeSelector from './AssigneeSelector.jsx'

const PRIORITIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
]

function getInitialFormData(initialData, teams, panelTerms) {
  if (initialData) {
    let formattedDue = ''
    if (initialData.due_at) {
      try {
        const d = new Date(initialData.due_at)
        formattedDue = d.toISOString().slice(0, 16)
      } catch {
        formattedDue = ''
      }
    }

    return {
      task_title: initialData.task_title || '',
      task_description: initialData.task_description || '',
      team_id: String(initialData.team_id || ''),
      priority: initialData.priority || 'MEDIUM',
      due_at: formattedDue,
      panel_term_id: String(initialData.panel_term_id || '1'),
      panel_membership_ids: initialData.assignees
        ? initialData.assignees.map((a) => String(a.panel_membership_id))
        : [],
    }
  }

  return {
    task_title: '',
    task_description: '',
    team_id: teams[0]?.team_id ? String(teams[0].team_id) : '',
    priority: 'MEDIUM',
    due_at: '',
    panel_term_id: panelTerms[0]?.panel_term_id ? String(panelTerms[0].panel_term_id) : '1',
    panel_membership_ids: [],
  }
}

function TaskFormContent({
  initialData,
  teams,
  panelTerms,
  eligibleMembers,
  onSubmit,
  onClose,
}) {
  const isEditing = Boolean(initialData?.task_id)
  const [formData, setFormData] = useState(() =>
    getInitialFormData(initialData, teams, panelTerms)
  )
  const [errors, setErrors] = useState({})
  const [rejectionReasons, setRejectionReasons] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const validate = () => {
    const errs = {}
    if (!formData.task_title.trim()) {
      errs.task_title = 'Task title is required.'
    } else if (formData.task_title.trim().length > 255) {
      errs.task_title = 'Task title cannot exceed 255 characters.'
    }

    if (!formData.team_id) {
      errs.team_id = 'Please select a team.'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    setRejectionReasons(null)
    try {
      const payload = {
        task_title: formData.task_title.trim(),
        task_description: formData.task_description.trim() || null,
        team_id: formData.team_id,
        priority: formData.priority,
        panel_term_id: formData.panel_term_id,
        due_at: formData.due_at ? new Date(formData.due_at).toISOString() : null,
        panel_membership_ids: formData.panel_membership_ids,
      }

      await onSubmit(payload)
      onClose()
    } catch (err) {
      setErrors({ form: err.message || 'Failed to save task.' })
      if (err.details) {
        setRejectionReasons(err.details)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {errors.form && (
        <div className="rounded-sm border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
          {errors.form}
        </div>
      )}

      {/* Task Title */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="task_title"
          className="font-mono text-xs uppercase tracking-[0.1em] text-subtle"
        >
          Task Title <span className="text-danger">*</span>
        </label>
        <input
          id="task_title"
          type="text"
          required
          maxLength={255}
          value={formData.task_title}
          onChange={(e) => setFormData({ ...formData, task_title: e.target.value })}
          placeholder="e.g. Calibrate Arena Sensors & Gates"
          className="rounded-sm border border-edge bg-surface-1 px-3 py-2 text-sm text-ink placeholder:text-subtle transition-colors focus:border-brand-500 focus:outline-none"
        />
        {errors.task_title && (
          <span className="text-xs text-danger">{errors.task_title}</span>
        )}
      </div>

      {/* Team & Priority Row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Team */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="team_id"
            className="font-mono text-xs uppercase tracking-[0.1em] text-subtle"
          >
            Responsible Team <span className="text-danger">*</span>
          </label>
          <select
            id="team_id"
            value={formData.team_id}
            onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
            className="rounded-sm border border-edge bg-surface-1 px-3 py-2 text-sm text-ink transition-colors focus:border-brand-500 focus:outline-none"
          >
            <option value="" disabled>
              Select team...
            </option>
            {teams.map((t) => (
              <option key={t.team_id} value={t.team_id} className="bg-surface-2 text-ink">
                {t.team_name}
              </option>
            ))}
          </select>
          {errors.team_id && <span className="text-xs text-danger">{errors.team_id}</span>}
        </div>

        {/* Priority */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="priority"
            className="font-mono text-xs uppercase tracking-[0.1em] text-subtle"
          >
            Priority
          </label>
          <select
            id="priority"
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            className="rounded-sm border border-edge bg-surface-1 px-3 py-2 text-sm text-ink transition-colors focus:border-brand-500 focus:outline-none"
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value} className="bg-surface-2 text-ink">
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Due Date */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="due_at"
          className="font-mono text-xs uppercase tracking-[0.1em] text-subtle"
        >
          Target Due Date
        </label>
        <input
          id="due_at"
          type="datetime-local"
          value={formData.due_at}
          onChange={(e) => setFormData({ ...formData, due_at: e.target.value })}
          className="rounded-sm border border-edge bg-surface-1 px-3 py-2 text-sm text-ink transition-colors focus:border-brand-500 focus:outline-none [color-scheme:dark]"
        />
      </div>

      {/* Task Description */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="task_description"
          className="font-mono text-xs uppercase tracking-[0.1em] text-subtle"
        >
          Specification / Work Scope
        </label>
        <textarea
          id="task_description"
          rows={3}
          value={formData.task_description}
          onChange={(e) => setFormData({ ...formData, task_description: e.target.value })}
          placeholder="Detailed scope, expected deliverables, references, or instructions..."
          className="rounded-sm border border-edge bg-surface-1 px-3 py-2 text-sm text-ink placeholder:text-subtle transition-colors focus:border-brand-500 focus:outline-none resize-none"
        />
      </div>

      {/* Multi-Assignee Selection */}
      <div className="border-t border-edge-subtle pt-3">
        <AssigneeSelector
          selectedIds={formData.panel_membership_ids}
          onChange={(ids) => {
            setFormData({ ...formData, panel_membership_ids: ids })
            if (rejectionReasons) setRejectionReasons(null)
          }}
          eligibleMembers={eligibleMembers}
          teamId={formData.team_id}
          rejectionReasons={rejectionReasons}
        />
      </div>

      {/* Modal Actions */}
      <div className="mt-2 flex items-center justify-end gap-3 border-t border-edge-subtle pt-4">
        <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" loading={submitting}>
          {isEditing ? 'Save Changes' : 'Create Task'}
        </Button>
      </div>
    </form>
  )
}

function TaskFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData = null,
  teams = [],
  panelTerms = [],
  eligibleMembers = [],
}) {
  if (!isOpen) return null

  const isEditing = Boolean(initialData?.task_id)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Task Specification' : 'Create New Administration Task'}
    >
      <TaskFormContent
        key={initialData?.task_id || 'new-task'}
        initialData={initialData}
        teams={teams}
        panelTerms={panelTerms}
        eligibleMembers={eligibleMembers}
        onSubmit={onSubmit}
        onClose={onClose}
      />
    </Modal>
  )
}

export default TaskFormModal
