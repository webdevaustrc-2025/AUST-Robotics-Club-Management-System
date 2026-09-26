import { useState } from 'react'
import { CheckCircle2, RotateCcw, XCircle, MessageSquare, X, AlertCircle } from 'lucide-react'
import { submitTaskReview } from '../services/taskService.js'

export function TaskReviewModal({ task, submission, onReviewSuccess, onClose }) {
  const [reviewStatus, setReviewStatus] = useState('APPROVED')
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (reviewStatus === 'REVISION_REQUESTED' && !remarks.trim()) {
      setError('Please provide feedback remarks explaining what revisions are needed.')
      return
    }

    setSubmitting(true)
    try {
      await submitTaskReview(task.task_id, submission.task_submission_id, {
        reviewStatus,
        remarks: remarks.trim(),
      })
      onReviewSuccess()
    } catch (err) {
      setError(err.message || 'Failed to submit review')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg p-6 rounded-2xl border border-edge bg-surface-1 shadow-lg space-y-5">
        <div className="flex items-center justify-between border-b border-edge pb-4">
          <div>
            <h3 className="text-base font-bold text-ink flex items-center gap-2">
              Review Submission v{submission.version_no}
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Task #{task.task_id} — <span className="font-medium text-ink">{submission.submitter_name || 'Assignee'}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-subtle hover:text-ink rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Decision Selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-ink">Review Decision</label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setReviewStatus('APPROVED')}
                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                  reviewStatus === 'APPROVED'
                    ? 'border-brand-500 bg-brand-500/10 text-brand-400 font-bold'
                    : 'border-edge bg-surface-2 text-subtle hover:text-ink hover:border-edge-strong'
                }`}
              >
                <CheckCircle2 className="w-5 h-5 text-brand-500" />
                <span className="text-xs">Approve</span>
              </button>

              <button
                type="button"
                onClick={() => setReviewStatus('REVISION_REQUESTED')}
                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                  reviewStatus === 'REVISION_REQUESTED'
                    ? 'border-warning bg-warning/10 text-warning font-bold'
                    : 'border-edge bg-surface-2 text-subtle hover:text-ink hover:border-edge-strong'
                }`}
              >
                <RotateCcw className="w-5 h-5 text-warning" />
                <span className="text-xs">Request Revision</span>
              </button>

              <button
                type="button"
                onClick={() => setReviewStatus('REJECTED')}
                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                  reviewStatus === 'REJECTED'
                    ? 'border-danger bg-danger/10 text-danger font-bold'
                    : 'border-edge bg-surface-2 text-subtle hover:text-ink hover:border-edge-strong'
                }`}
              >
                <XCircle className="w-5 h-5 text-danger" />
                <span className="text-xs">Reject</span>
              </button>
            </div>
          </div>

          {/* Feedback Remarks */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-brand-400" />
              Reviewer Remarks / Feedback
              {reviewStatus === 'REVISION_REQUESTED' && (
                <span className="text-danger">* (Required for revisions)</span>
              )}
            </label>
            <textarea
              rows={4}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={
                reviewStatus === 'REVISION_REQUESTED'
                  ? 'Detail the requested changes or improvements required...'
                  : 'Add optional review notes or comments...'
              }
              className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-edge text-xs text-ink placeholder-faint focus:outline-none focus:border-brand-500 transition-colors resize-y"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-edge">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-subtle hover:text-ink transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-brand-500 hover:bg-brand-400 text-brand-950 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Recording Decision...' : 'Save Review Decision'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
