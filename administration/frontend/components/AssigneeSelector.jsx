import { useMemo, useState } from 'react'
import { AlertCircle, Check, Search, X } from 'lucide-react'

function initialsOf(name) {
  if (!name) return 'MB'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const REASON_LABELS = {
  SELF: 'Cannot assign task to yourself',
  SAME_RANK: 'Equal rank to assigner',
  HIGHER_RANK: 'Higher rank than assigner',
  POSITION_NOT_IN_HIERARCHY: 'Position is not ranked in hierarchy',
  ACTOR_POSITION_NOT_IN_HIERARCHY: 'Assigner is not ranked in hierarchy',
  NOT_FOUND_OR_INACTIVE: 'Inactive or ineligible member',
}

/**
 * Multi-Assignee Selector working strictly with panel_membership_id.
 * Displays member initials, name, student ID, position, and team.
 * Enforces hierarchy feedback: shows empty state when no lower-ranked members exist,
 * and highlights per-person rejection reasons when backend/API rejects assignments.
 */
function AssigneeSelector({
  selectedIds = [],
  onChange,
  eligibleMembers = [],
  disabled = false,
  label = 'Assign Panel Members',
  helperText = 'Select one or more active panel members for this task.',
  rejectionReasons = null,
}) {
  const [search, setSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  // Normalize rejection reasons into a fast lookup map: panel_membership_id -> reason
  const rejectionMap = useMemo(() => {
    if (!rejectionReasons) return {}
    if (Array.isArray(rejectionReasons)) {
      const map = {}
      for (const item of rejectionReasons) {
        if (item?.panel_membership_id) {
          map[String(item.panel_membership_id)] = item.reason || 'HIERARCHY_VIOLATION'
        }
      }
      return map
    }
    if (typeof rejectionReasons === 'object') {
      return rejectionReasons
    }
    return {}
  }, [rejectionReasons])

  const hasRejections = Object.keys(rejectionMap).length > 0

  // Map of selected members for chips display
  const selectedMembers = useMemo(() => {
    return selectedIds
      .map((id) => eligibleMembers.find((m) => String(m.panel_membership_id) === String(id)))
      .filter(Boolean)
  }, [selectedIds, eligibleMembers])

  // Filtered available members for dropdown
  const filteredAvailable = useMemo(() => {
    const query = search.toLowerCase().trim()
    return eligibleMembers.filter((m) => {
      const matchesSearch =
        !query ||
        m.member_name.toLowerCase().includes(query) ||
        m.student_id.toLowerCase().includes(query) ||
        m.position_title.toLowerCase().includes(query) ||
        (m.team_name && m.team_name.toLowerCase().includes(query))
      return matchesSearch
    })
  }, [eligibleMembers, search])

  const toggleMember = (panelMembershipId) => {
    if (disabled) return
    const idStr = String(panelMembershipId)
    const exists = selectedIds.some((id) => String(id) === idStr)
    let next
    if (exists) {
      next = selectedIds.filter((id) => String(id) !== idStr)
    } else {
      next = [...selectedIds, idStr]
    }
    onChange(next)
  }

  const removeMember = (panelMembershipId, event) => {
    event.stopPropagation()
    if (disabled) return
    const idStr = String(panelMembershipId)
    onChange(selectedIds.filter((id) => String(id) !== idStr))
  }

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <div className="flex items-center justify-between">
          <label className="font-mono text-xs uppercase tracking-[0.1em] text-subtle">
            {label}
          </label>
          <span className="font-mono text-xs text-faint">
            {selectedIds.length} {selectedIds.length === 1 ? 'member' : 'members'} assigned
          </span>
        </div>
      )}

      {/* Hierarchy Policy Rejection Alert */}
      {hasRejections && (
        <div className="flex items-start gap-2 rounded-sm border border-danger/40 bg-danger/10 p-2.5 text-xs text-danger">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <span className="font-medium">Hierarchy assignment violation:</span> One or more selected members cannot be assigned by your current rank. Check the badges below for details.
          </div>
        </div>
      )}

      {/* Selected Assignee Chips */}
      {selectedMembers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 rounded-sm border border-edge-subtle bg-surface-1 p-2">
          {selectedMembers.map((member) => {
            const memberIdStr = String(member.panel_membership_id)
            const rejectionReason = rejectionMap[memberIdStr]
            return (
              <span
                key={member.panel_membership_id}
                className={`inline-flex items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-2 text-xs text-ink transition-colors ${
                  rejectionReason
                    ? 'border-danger/60 bg-danger/15'
                    : 'border-brand-500/30 bg-brand-500/10'
                }`}
              >
                <span
                  className={`grid size-5 place-items-center rounded-full font-display text-[0.625rem] font-bold ${
                    rejectionReason
                      ? 'bg-danger text-white'
                      : 'bg-linear-135 from-brand-500 to-brand-700 text-[#04170c]'
                  }`}
                  aria-hidden="true"
                >
                  {initialsOf(member.member_name)}
                </span>
                <span className="font-medium">{member.member_name}</span>
                <span className="font-mono text-[0.625rem] text-brand-300">
                  ({member.position_title})
                </span>
                {rejectionReason && (
                  <span className="rounded bg-danger/25 px-1.5 py-0.5 font-mono text-[0.625rem] font-semibold text-danger">
                    {REASON_LABELS[rejectionReason] || rejectionReason}
                  </span>
                )}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => removeMember(member.panel_membership_id, e)}
                    aria-label={`Remove ${member.member_name}`}
                    className="ml-0.5 rounded-full p-0.5 text-subtle transition-colors hover:bg-surface-hover hover:text-danger"
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            )
          })}
        </div>
      )}

      {/* Trigger & Search Bar */}
      <div className="relative">
        <div className="flex items-center rounded-sm border border-edge bg-surface-2 transition-colors duration-fast focus-within:border-brand-500">
          <div className="grid size-10 place-items-center text-subtle">
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder={
              eligibleMembers.length === 0
                ? 'No lower-ranked members available for assignment'
                : selectedIds.length > 0
                ? 'Search more members to add...'
                : 'Search eligible panel members by name, ID or position...'
            }
            value={search}
            disabled={disabled || eligibleMembers.length === 0}
            onChange={(e) => {
              setSearch(e.target.value)
              if (!dropdownOpen) setDropdownOpen(true)
            }}
            onFocus={() => {
              if (eligibleMembers.length > 0) setDropdownOpen(true)
            }}
            className="w-full bg-transparent py-2 pr-4 text-sm text-ink placeholder:text-subtle focus:outline-none disabled:cursor-not-allowed"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="mr-2 grid size-7 place-items-center rounded-sm text-subtle hover:text-ink"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Dropdown Options */}
        {dropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setDropdownOpen(false)}
              aria-hidden="true"
            />
            <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-60 overflow-y-auto rounded-md border border-edge bg-surface-2 shadow-lg">
              <div className="border-b border-edge-subtle px-3 py-2 text-[0.6875rem] font-mono uppercase tracking-[0.1em] text-subtle">
                Eligible Panel Members ({filteredAvailable.length})
              </div>
              {eligibleMembers.length === 0 ? (
                <div className="p-4 text-center text-xs text-subtle">
                  No lower-ranked members available
                </div>
              ) : filteredAvailable.length === 0 ? (
                <div className="p-4 text-center text-xs text-subtle">
                  No matching panel members found.
                </div>
              ) : (
                <ul className="divide-y divide-edge-subtle">
                  {filteredAvailable.map((member) => {
                    const memberIdStr = String(member.panel_membership_id)
                    const isSelected = selectedIds.some(
                      (id) => String(id) === memberIdStr
                    )
                    const rejectionReason = rejectionMap[memberIdStr]

                    return (
                      <li key={member.panel_membership_id}>
                        <button
                          type="button"
                          onClick={() => toggleMember(member.panel_membership_id)}
                          className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-xs transition-colors duration-fast hover:bg-surface-hover ${
                            isSelected ? 'bg-brand-500/10' : ''
                          } ${rejectionReason ? 'bg-danger/5' : ''}`}
                        >
                          <div
                            className={`grid size-4 shrink-0 place-items-center rounded border ${
                              isSelected
                                ? 'border-brand-500 bg-brand-500 text-[#04170c]'
                                : 'border-edge bg-surface-1'
                            }`}
                          >
                            {isSelected && <Check size={11} strokeWidth={3} />}
                          </div>

                          <div
                            className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-3 font-display text-xs font-semibold text-brand-300"
                            aria-hidden="true"
                          >
                            {initialsOf(member.member_name)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-medium text-ink">
                                {member.member_name}
                              </span>
                              <span className="font-mono text-[0.6875rem] text-subtle">
                                {member.student_id}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[0.6875rem] text-muted">
                              <span>{member.position_title}</span>
                              <span className="text-subtle">•</span>
                              <span className="truncate text-subtle">{member.team_name}</span>
                            </div>
                            {rejectionReason && (
                              <div className="mt-0.5 text-[0.6875rem] font-medium text-danger">
                                ⚠ {REASON_LABELS[rejectionReason] || rejectionReason}
                              </div>
                            )}
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      {helperText && <p className="text-xs text-subtle">{helperText}</p>}
    </div>
  )
}

export default AssigneeSelector
