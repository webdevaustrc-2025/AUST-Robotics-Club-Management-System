import { useState } from 'react'
import { Upload, Link as LinkIcon, FileText, X, AlertCircle, Send, CheckCircle2 } from 'lucide-react'
import { uploadSubmissionFile } from '../services/taskService.js'

export function TaskSubmissionForm({ task, onSubmissionSuccess, onCancel }) {
  const [submissionText, setSubmissionText] = useState('')
  const [submissionLink, setSubmissionLink] = useState('')
  const [attachedFiles, setAttachedFiles] = useState([]) // [{ file_id, original_name, file_size_bytes }]
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setUploading(true)
    setError(null)

    try {
      for (const file of files) {
        const uploaded = await uploadSubmissionFile(task.task_id, file)
        setAttachedFiles((prev) => [...prev, uploaded])
      }
    } catch (err) {
      setError(err.message || 'Failed to upload file')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const removeFile = (fileId) => {
    setAttachedFiles((prev) => prev.filter((f) => f.file_id !== fileId))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!submissionText.trim() && !submissionLink.trim() && attachedFiles.length === 0) {
      setError('Please provide text description, a link, or at least one file.')
      return
    }

    setSubmitting(true)
    try {
      const fileIds = attachedFiles.map((f) => f.file_id)
      await onSubmissionSuccess({
        submissionText,
        submissionLink,
        fileIds,
      })
      setSuccessMessage('Submission recorded successfully!')
      setSubmissionText('')
      setSubmissionLink('')
      setAttachedFiles([])
    } catch (err) {
      setError(err.message || 'Failed to create submission')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 rounded-xl border border-edge bg-surface-1 space-y-5">
      <div className="flex items-center justify-between border-b border-edge pb-4">
        <div>
          <h3 className="text-base font-semibold text-ink">Submit Task Deliverables</h3>
          <p className="text-xs text-muted mt-0.5">
            Submit work for <span className="font-semibold text-brand-400">{task.task_title}</span>. Each submission creates a new versioned snapshot.
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="p-1 text-subtle hover:text-ink rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 rounded-lg bg-success/10 border border-success/30 text-success text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Submission Text */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-ink flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-brand-400" />
          Submission Summary / Notes
        </label>
        <textarea
          rows={4}
          value={submissionText}
          onChange={(e) => setSubmissionText(e.target.value)}
          placeholder="Describe your progress, deliverables, or submission details..."
          className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-edge text-xs text-ink placeholder-faint focus:outline-none focus:border-brand-500 transition-colors resize-y"
        />
      </div>

      {/* Submission Link */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-ink flex items-center gap-1.5">
          <LinkIcon className="w-3.5 h-3.5 text-brand-400" />
          External Resource / Repository Link (Optional)
        </label>
        <input
          type="url"
          value={submissionLink}
          onChange={(e) => setSubmissionLink(e.target.value)}
          placeholder="https://github.com/austrc/project-repo"
          className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-edge text-xs text-ink placeholder-faint focus:outline-none focus:border-brand-500 transition-colors"
        />
      </div>

      {/* File Upload Section */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-ink flex items-center gap-1.5">
          <Upload className="w-3.5 h-3.5 text-brand-400" />
          Attach Files
        </label>

        <div className="relative border border-dashed border-edge rounded-lg p-4 bg-surface-2/40 text-center hover:border-brand-500/50 transition-colors">
          <input
            type="file"
            multiple
            onChange={handleFileUpload}
            disabled={uploading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />
          <Upload className="w-6 h-6 mx-auto mb-1.5 text-subtle" />
          <p className="text-xs text-ink font-medium">
            {uploading ? 'Uploading file...' : 'Click or drag files here to attach'}
          </p>
          <p className="text-[10px] text-faint mt-0.5">Documents, PDFs, ZIPs, images up to 10MB</p>
        </div>

        {/* Attached Files List */}
        {attachedFiles.length > 0 && (
          <div className="space-y-1.5 mt-2">
            <span className="text-[11px] font-medium text-subtle">Attached ({attachedFiles.length}):</span>
            <div className="flex flex-wrap gap-2">
              {attachedFiles.map((f) => (
                <div
                  key={f.file_id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-3 border border-edge text-xs text-ink"
                >
                  <FileText className="w-3.5 h-3.5 text-brand-400" />
                  <span className="truncate max-w-[160px]">{f.original_name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(f.file_id)}
                    className="text-subtle hover:text-danger ml-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Form Buttons */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-edge">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs font-medium text-subtle hover:text-ink transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting || uploading}
          className="px-4 py-2 rounded-lg text-xs font-medium bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" />
          {submitting ? 'Submitting...' : 'Submit Work Version'}
        </button>
      </div>
    </form>
  )
}
