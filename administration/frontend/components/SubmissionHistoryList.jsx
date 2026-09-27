import { History, Link as LinkIcon, Paperclip, FileText, CheckCircle, RotateCcw, XCircle, MessageSquare, ShieldCheck } from 'lucide-react'

function resolveFileUrl(publicUrl) {
  if (!publicUrl) return '#'
  const base = import.meta.env.VITE_API_BASE_URL || window.location.origin
  try {
    return new URL(publicUrl, base).toString()
  } catch {
    return publicUrl
  }
}

export function SubmissionHistoryList({ submissions, loading, isReviewer, onReviewClick }) {
  if (loading) {
    return (
      <div className="p-8 text-center text-muted animate-pulse">
        <p>Loading submission history...</p>
      </div>
    )
  }

  if (!submissions || submissions.length === 0) {
    return (
      <div className="p-8 rounded-xl border border-edge bg-surface-2/40 text-center">
        <History className="w-10 h-10 mx-auto mb-3 text-faint" />
        <h4 className="text-sm font-semibold text-ink">No Submissions Yet</h4>
        <p className="text-xs text-muted mt-1">
          When work is submitted for this task, submission versions will appear here with full history and review records.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
          <History className="w-4 h-4 text-brand-500" />
          Submission & Review History ({submissions.length} {submissions.length === 1 ? 'version' : 'versions'})
        </h3>
        <span className="text-xs text-subtle font-mono">Preserved Timeline</span>
      </div>

      <div className="space-y-3">
        {submissions.map((sub) => {
          const filesList = Array.isArray(sub.files) ? sub.files : []
          const reviewsList = Array.isArray(sub.reviews) ? sub.reviews : []
          const latestReview = reviewsList.length > 0 ? reviewsList[0] : null
          const reviewStatus = latestReview?.review_status || sub.status || 'SUBMITTED'

          return (
            <div
              key={sub.task_submission_id || sub.version_no}
              className="p-4 rounded-xl border border-edge bg-surface-2/70 hover:border-edge-strong transition-colors space-y-3"
            >
              {/* Header Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-edge-subtle pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-brand-500/20 text-brand-400 border border-brand-500/30">
                    v{sub.version_no}
                  </span>
                  <span className="text-xs font-semibold text-ink">{sub.submitter_name || 'Assignee'}</span>
                  {sub.submitter_code && (
                    <span className="text-xs text-faint">({sub.submitter_code})</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Status Badge */}
                  {reviewStatus === 'APPROVED' && (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-brand-500/20 text-brand-400 border border-brand-500/30">
                      <CheckCircle className="w-3.5 h-3.5" /> Approved
                    </span>
                  )}
                  {reviewStatus === 'REVISION_REQUESTED' && (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-warning/20 text-warning border border-warning/30 animate-pulse">
                      <RotateCcw className="w-3.5 h-3.5" /> Revision Requested
                    </span>
                  )}
                  {reviewStatus === 'REJECTED' && (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-danger/20 text-danger border border-danger/30">
                      <XCircle className="w-3.5 h-3.5" /> Rejected
                    </span>
                  )}
                  {reviewStatus === 'SUBMITTED' && (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-medium bg-surface-3 text-subtle border border-edge">
                      Pending Review
                    </span>
                  )}

                  {isReviewer && onReviewClick && (
                    <button
                      onClick={() => onReviewClick(sub)}
                      className="px-2.5 py-1 rounded text-xs font-bold bg-brand-500 hover:bg-brand-400 text-brand-950 transition-colors flex items-center gap-1 ml-2"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" /> Review v{sub.version_no}
                    </button>
                  )}
                </div>
              </div>

              {/* Submission Text */}
              {sub.submission_text && (
                <div className="text-xs text-muted bg-surface-3/50 p-3 rounded-lg border border-edge-subtle whitespace-pre-wrap">
                  {sub.submission_text}
                </div>
              )}

              {/* Submission Link */}
              {sub.submission_link && (
                <div className="flex items-center gap-2 text-xs">
                  <LinkIcon className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                  <a
                    href={sub.submission_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-400 hover:underline truncate max-w-md"
                  >
                    {sub.submission_link}
                  </a>
                </div>
              )}

              {/* Files */}
              {filesList.length > 0 && (
                <div className="pt-2 border-t border-edge-subtle">
                  <div className="text-xs font-medium text-subtle mb-1.5 flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-faint" />
                    Attached Files ({filesList.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {filesList.map((file, idx) => (
                      <a
                        key={file.file_id || idx}
                        href={resolveFileUrl(file.public_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-surface-1 border border-edge text-ink hover:border-brand-500/50 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5 text-brand-400" />
                        <span className="truncate max-w-[180px]">{file.original_name}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Reviews History */}
              {reviewsList.length > 0 && (
                <div className="pt-3 border-t border-edge space-y-2">
                  <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-brand-400" />
                    Review Feedback ({reviewsList.length})
                  </span>
                  <div className="space-y-2">
                    {reviewsList.map((rev) => (
                      <div
                        key={rev.task_submission_review_id}
                        className={`p-3 rounded-lg border text-xs space-y-1 ${
                          rev.review_status === 'APPROVED'
                            ? 'bg-brand-500/5 border-brand-500/20'
                            : rev.review_status === 'REVISION_REQUESTED'
                            ? 'bg-warning/5 border-warning/20'
                            : 'bg-danger/5 border-danger/20'
                        }`}
                      >
                        <div className="flex items-center justify-between font-medium">
                          <span className="text-ink">
                            Reviewed by: <span className="font-semibold">{rev.reviewer_name || 'Reviewer'}</span>
                          </span>
                          <span className="text-faint text-[10px]">
                            {new Date(rev.reviewed_at).toLocaleString()}
                          </span>
                        </div>
                        {rev.remarks && <p className="text-muted italic">{rev.remarks}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
