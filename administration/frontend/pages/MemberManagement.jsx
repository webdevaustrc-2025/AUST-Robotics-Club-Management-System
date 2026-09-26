
import { useState, useEffect, useMemo } from 'react'
import {
  UsersRound,
  History,
  UserPlus,
  Calendar,
  Layers,
  Briefcase,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  ShieldCheck,
  Building2,
  Filter,
  Award,
  Download,
  ChevronRight,
} from 'lucide-react'

import Badge from '../../../shared-features/frontend/components/Badge.jsx'
import Button from '../../../shared-features/frontend/components/Button.jsx'
import DataTable from '../../../shared-features/frontend/components/DataTable.jsx'
import Modal from '../../../shared-features/frontend/components/Modal.jsx'
import Loader from '../../../shared-features/frontend/components/Loader.jsx'

import usePanelTerms from '../hooks/usePanelTerms.js'
import usePositions from '../hooks/usePositions.js'
import useTeams from '../hooks/useTeams.js'
import useMemberships from '../hooks/useMemberships.js'
import useCertificates from '../hooks/useCertificates.js'

function formatDate(val) {
  if (!val) return '—'
  return String(val).split('T')[0]
}

export default function MemberManagement() {
  const [activeTab, setActiveTab] = useState('roster') // 'roster' | 'history'

  // Task 4 hooks for lookup data
  const { terms, loading: termsLoading } = usePanelTerms()
  const { positions, loading: positionsLoading } = usePositions()
  const { teams, loading: teamsLoading } = useTeams()

  // Task 5 membership hook
  const {
    roster,
    rosterLoading,
    rosterError,
    loadRoster,

    historyData,
    historyLoading,
    historyError,
    loadMemberHistory,

    members,
    membersLoading,
    loadMembers,

    actionLoading,
    actionError,
    clearErrors,

    assignMember,
    endMembership,
  } = useMemberships()

  const {
    memberCertData,
    memberCertLoading,
    loadCertsByMember,
  } = useCertificates()

  // Selected filters
  const [selectedTermId, setSelectedTermId] = useState('')
  const [selectedMemberId, setSelectedMemberId] = useState('')

  // Modals state
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [endModalOpen, setEndModalOpen] = useState(false)
  const [targetMembership, setTargetMembership] = useState(null)

  // Assign Form state
  const [assignForm, setAssignForm] = useState({
    panel_term_id: '',
    member_id: '',
    position_id: '',
    team_id: '',
    appointed_at: new Date().toISOString().split('T')[0],
    notes: '',
  })
  const [assignFormError, setAssignFormError] = useState(null)

  // End Form state
  const [endForm, setEndForm] = useState({
    ended_at: new Date().toISOString().split('T')[0],
    notes: '',
  })
  const [endFormError, setEndFormError] = useState(null)

  // Toast / success notice
  const [successMessage, setSuccessMessage] = useState(null)

  // Initial data loading
  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  // Select first active/planned term by default once terms are loaded
  useEffect(() => {
    if (terms.length > 0 && !selectedTermId) {
      const activeTerm = terms.find((t) => t.status === 'ACTIVE') || terms[0]
      setSelectedTermId(String(activeTerm.panel_term_id))
    }
  }, [terms, selectedTermId])

  // Fetch roster when selected term changes
  useEffect(() => {
    if (selectedTermId) {
      loadRoster(selectedTermId)
    }
  }, [selectedTermId, loadRoster])

  // Fetch member history when selected member changes
  useEffect(() => {
    if (selectedMemberId) {
      loadMemberHistory(selectedMemberId)
      loadCertsByMember(selectedMemberId)
    } else {
      loadMemberHistory(null)
    }
  }, [selectedMemberId, loadMemberHistory, loadCertsByMember])

  // Current active term object
  const currentTerm = useMemo(() => {
    return terms.find((t) => String(t.panel_term_id) === String(selectedTermId))
  }, [terms, selectedTermId])

  // Filter active positions and teams for assignment dropdown
  const activePositions = useMemo(() => {
    return positions.filter((p) => p.status === 'ACTIVE')
  }, [positions])

  const activeTeams = useMemo(() => {
    return teams.filter((t) => t.status === 'ACTIVE')
  }, [teams])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const openAssignModal = () => {
    setAssignForm({
      panel_term_id: selectedTermId || (terms[0]?.panel_term_id ? String(terms[0].panel_term_id) : ''),
      member_id: selectedMemberId || (members[0]?.member_id ? String(members[0].member_id) : ''),
      position_id: activePositions[0]?.position_id ? String(activePositions[0].position_id) : '',
      team_id: '',
      appointed_at: new Date().toISOString().split('T')[0],
      notes: '',
    })
    setAssignFormError(null)
    setAssignModalOpen(true)
  }

  const handleAssignSubmit = async (e) => {
    e.preventDefault()
    setAssignFormError(null)

    if (!assignForm.panel_term_id) {
      setAssignFormError('Please select a panel term.')
      return
    }
    if (!assignForm.member_id) {
      setAssignFormError('Please select an official club member.')
      return
    }
    if (!assignForm.position_id) {
      setAssignFormError('Please select a position.')
      return
    }
    if (!assignForm.appointed_at) {
      setAssignFormError('Please select an appointment date.')
      return
    }

    const payload = {
      panel_term_id: Number(assignForm.panel_term_id),
      member_id: Number(assignForm.member_id),
      position_id: Number(assignForm.position_id),
      team_id: assignForm.team_id ? Number(assignForm.team_id) : null,
      appointed_at: assignForm.appointed_at,
      notes: assignForm.notes || null,
    }

    const res = await assignMember(payload)
    if (res.success) {
      setAssignModalOpen(false)
      setSuccessMessage('Member successfully appointed to panel.')
      setTimeout(() => setSuccessMessage(null), 4000)
      // Refresh current view
      if (selectedTermId) loadRoster(selectedTermId)
      if (selectedMemberId && String(selectedMemberId) === String(payload.member_id)) {
        loadMemberHistory(selectedMemberId)
      }
    } else {
      setAssignFormError(res.error)
    }
  }

  const openEndModal = (membership) => {
    setTargetMembership(membership)
    setEndForm({
      ended_at: new Date().toISOString().split('T')[0],
      notes: '',
    })
    setEndFormError(null)
    setEndModalOpen(true)
  }

  const handleEndSubmit = async (e) => {
    e.preventDefault()
    setEndFormError(null)

    if (!endForm.ended_at) {
      setEndFormError('Please specify the date this appointment concludes.')
      return
    }

    const res = await endMembership(targetMembership.panel_membership_id, endForm)
    if (res.success) {
      setEndModalOpen(false)
      setSuccessMessage('Panel appointment successfully concluded. Historical record preserved.')
      setTimeout(() => setSuccessMessage(null), 4000)
      if (selectedTermId) loadRoster(selectedTermId)
      if (selectedMemberId) loadMemberHistory(selectedMemberId)
    } else {
      setEndFormError(res.error)
    }
  }

  const viewMemberHistoryFromRoster = (memberId) => {
    setSelectedMemberId(String(memberId))
    setActiveTab('history')
  }

  // ── Table Column Definitions ────────────────────────────────────────────────
  const rosterColumns = [
    {
      key: 'member',
      header: 'Official Member',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-ink">{row.member_name}</span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-xs text-brand-400 font-semibold">{row.member_code}</span>
            {row.primary_email && (
              <span className="text-xs text-subtle truncate max-w-[200px]" title={row.primary_email}>
                {row.primary_email}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'position',
      header: 'Position & Rank',
      render: (row) => (
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-ink">{row.position_name}</span>
            {row.can_assign_tasks && (
              <span title="Authorized to assign tasks" className="text-brand-400">
                <ShieldCheck size={14} />
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[11px] text-subtle">
              Lvl {row.hierarchy_level}
            </span>
            <span className="font-mono text-[11px] text-faint">{row.position_key}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'team',
      header: 'Assigned Team',
      render: (row) =>
        row.team_name ? (
          <div>
            <span className="font-medium text-ink text-xs">{row.team_name}</span>
            <div className="font-mono text-[11px] text-subtle">{row.team_key}</div>
          </div>
        ) : (
          <span className="text-xs text-faint italic">Club-wide Executive</span>
        ),
    },
    {
      key: 'tenure',
      header: 'Appointment Span',
      render: (row) => (
        <div className="flex flex-col font-mono text-xs">
          <span className="text-ink">From: {formatDate(row.appointed_at)}</span>
          <span className="text-subtle">
            To: {row.ended_at ? formatDate(row.ended_at) : 'Present (Active)'}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        if (row.status === 'ACTIVE' && !row.ended_at) {
          return (
            <Badge variant="success" dot pulse>
              ACTIVE
            </Badge>
          )
        }
        if (row.status === 'ENDED' || row.ended_at) {
          return <Badge variant="neutral">CONCLUDED</Badge>
        }
        return <Badge variant="warning">{row.status}</Badge>
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => viewMemberHistoryFromRoster(row.member_id)}
            aria-label={`View history for ${row.member_name}`}
          >
            <History size={13} />
            <span>History</span>
          </Button>

          {row.status === 'ACTIVE' && !row.ended_at && (
            <Button
              size="sm"
              variant="secondary"
              disabled={actionLoading}
              onClick={() => openEndModal(row)}
              className="text-warning hover:bg-warning/10"
              aria-label={`End appointment for ${row.member_name}`}
            >
              <Clock size={13} />
              <span>Conclude</span>
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-edge-subtle pb-5">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-brand-400">
            <span>Administration</span>
            <span>/</span>
            <span>Executive Structure</span>
            <span>/</span>
            <span>Ledger</span>
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Panel Membership & History
          </h1>
          <p className="mt-1 text-sm text-muted">
            Appoint official club members to annual executive panels and maintain an immutable record of leadership history.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={openAssignModal} disabled={termsLoading || membersLoading}>
            <UserPlus size={16} />
            <span>Assign Member</span>
          </Button>
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="flex items-center justify-between rounded-md border border-brand-500/40 bg-brand-500/10 px-4 py-3 text-sm text-brand-400 animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-brand-400 hover:opacity-80"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Global Error Banner */}
      {(rosterError || historyError || actionError) && (
        <div className="flex items-center justify-between rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{rosterError || historyError || actionError}</span>
          </div>
          <button
            type="button"
            onClick={clearErrors}
            className="text-danger hover:opacity-80"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-edge-subtle gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('roster')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition duration-fast ${activeTab === 'roster'
            ? 'border-brand-500 text-brand-400 bg-brand-500/5'
            : 'border-transparent text-muted hover:text-ink hover:border-edge'
            }`}
        >
          <UsersRound size={16} />
          <span>Panel Members</span>
          {roster.length > 0 && (
            <span className="rounded-full bg-surface-3 px-2 py-0.5 font-mono text-xs text-subtle">
              {roster.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition duration-fast ${activeTab === 'history'
            ? 'border-brand-500 text-brand-400 bg-brand-500/5'
            : 'border-transparent text-muted hover:text-ink hover:border-edge'
            }`}
        >
          <History size={16} />
          <span>Full Member History</span>
          {historyData?.history && (
            <span className="rounded-full bg-surface-3 px-2 py-0.5 font-mono text-xs text-subtle">
              {historyData.history.length} terms
            </span>
          )}
        </button>
      </div>

      {/* ── TAB 1: TERM ROSTER VIEW ────────────────────────────────────────── */}
      {activeTab === 'roster' && (
        <div className="space-y-4">
          {/* Term Selector & Details Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-edge bg-surface-1 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-500/10 text-brand-400">
                <Calendar size={20} />
              </div>
              <div>
                <label htmlFor="term_select" className="block text-[11px] font-mono uppercase tracking-wider text-subtle">
                  Viewing Panel Term
                </label>
                {termsLoading ? (
                  <span className="text-sm text-muted">Loading terms...</span>
                ) : (
                  <select
                    id="term_select"
                    value={selectedTermId}
                    onChange={(e) => setSelectedTermId(e.target.value)}
                    className="mt-0.5 rounded-sm border border-edge bg-surface-2 px-3 py-1 text-sm font-semibold text-ink focus:border-brand-500 focus:outline-none"
                  >
                    {terms.map((t) => (
                      <option key={t.panel_term_id} value={t.panel_term_id}>
                        {t.panel_title} ({t.status})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {currentTerm && (
              <div className="flex items-center gap-4 text-xs">
                <div className="flex flex-col sm:items-end">
                  <span className="font-mono text-subtle">Term Duration</span>
                  <span className="font-mono text-ink">
                    {formatDate(currentTerm.start_date)} → {formatDate(currentTerm.end_date)}
                  </span>
                </div>
                <div>
                  <Badge
                    variant={
                      currentTerm.status === 'ACTIVE'
                        ? 'success'
                        : currentTerm.status === 'PLANNED'
                          ? 'info'
                          : 'neutral'
                    }
                    dot={currentTerm.status === 'ACTIVE'}
                    pulse={currentTerm.status === 'ACTIVE'}
                  >
                    {currentTerm.status}
                  </Badge>
                </div>
              </div>
            )}
          </div>

          {/* Roster Table */}
          {rosterLoading ? (
            <Loader label="Loading executive panel roster..." />
          ) : (
            <DataTable
              columns={rosterColumns}
              rows={roster.map((r) => ({ ...r, id: r.panel_membership_id }))}
              emptyMessage={
                terms.length === 0
                  ? 'No panel terms found. Please create a panel term in Panel Management first.'
                  : 'No members assigned to this executive panel yet. Click "Assign Member" above to appoint the first officer.'
              }
            />
          )}
        </div>
      )}

      {/* ── TAB 2: MEMBER HISTORY TIMELINE VIEW ─────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Member Picker Header */}
          <div className="rounded-lg border border-edge bg-surface-1 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-500/10 text-brand-400">
                  <History size={20} />
                </div>
                <div>
                  <label htmlFor="member_select" className="block text-[11px] font-mono uppercase tracking-wider text-subtle">
                    Select Member to Inspect Historical Ledger
                  </label>
                  {membersLoading ? (
                    <span className="text-sm text-muted">Loading official members...</span>
                  ) : (
                    <select
                      id="member_select"
                      value={selectedMemberId}
                      onChange={(e) => setSelectedMemberId(e.target.value)}
                      className="mt-0.5 rounded-sm border border-edge bg-surface-2 px-3 py-1.5 text-sm font-semibold text-ink focus:border-brand-500 focus:outline-none min-w-[280px]"
                    >
                      <option value="">-- Choose an Official Club Member --</option>
                      {members.map((m) => (
                        <option key={m.member_id} value={m.member_id}>
                          {m.member_name} ({m.member_code})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {historyData?.member && (
                <div className="flex items-center gap-3 text-xs bg-surface-2 px-3 py-2 rounded border border-edge-subtle">
                  <div>
                    <span className="text-subtle block font-mono">Member Code</span>
                    <span className="font-mono font-bold text-brand-400">{historyData.member.member_code}</span>
                  </div>
                  <div className="border-l border-edge pl-3">
                    <span className="text-subtle block font-mono">Total Appointments</span>
                    <span className="font-mono font-bold text-ink">{historyData.history?.length ?? 0}</span>
                  </div>
                  <div className="border-l border-edge pl-3">
                    <span className="text-subtle block font-mono">Club Status</span>
                    <Badge variant={historyData.member.status === 'ACTIVE' ? 'success' : 'neutral'}>
                      {historyData.member.status}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Timeline Display */}
          {historyLoading ? (
            <Loader label="Loading member appointment history..." />
          ) : !selectedMemberId ? (
            <div className="rounded-lg border border-dashed border-edge p-12 text-center text-muted">
              <UsersRound size={36} className="mx-auto text-faint mb-3" />
              <p className="text-base font-medium text-ink">No Member Selected</p>
              <p className="text-sm text-subtle mt-1 max-w-md mx-auto">
                Select an official AUSTRC club member from the dropdown above to inspect their complete, immutable appointment history across all executive terms.
              </p>
            </div>
          ) : historyError ? (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-8 text-center">
              <AlertCircle size={36} className="mx-auto text-red-400 mb-3" />
              <p className="text-base font-medium text-ink">Failed to Load Member History</p>
              <p className="text-sm text-subtle mt-1">{historyError}</p>
            </div>
          ) : !historyData ? (
            <Loader label="Loading member appointment history..." />
          ) : !historyData.history || historyData.history.length === 0 ? (
            <div className="rounded-lg border border-dashed border-edge p-12 text-center text-muted">
              <History size={36} className="mx-auto text-faint mb-3" />
              <p className="text-base font-medium text-ink">No Executive Appointments Found</p>
              <p className="text-sm text-subtle mt-1">
                {historyData.member?.member_name || 'This member'} has not been appointed to any executive panels yet.
              </p>
              <Button size="sm" variant="primary" onClick={openAssignModal} className="mt-4">
                <UserPlus size={14} />
                <span>Appoint to Panel</span>
              </Button>
            </div>
          ) : (
            <div className="relative pl-6 sm:pl-8 before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-edge space-y-6">
              {historyData.history.map((record, index) => {
                const isActive = record.status === 'ACTIVE' && !record.ended_at
                return (
                  <div key={record.panel_membership_id} className="relative group">
                    {/* Timeline Node Dot */}
                    <div
                      className={`absolute -left-6 sm:-left-8 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-surface-1 transition ${isActive
                        ? 'border-brand-500 text-brand-400 shadow-[0_0_10px_rgba(57,181,74,0.3)]'
                        : 'border-edge text-subtle'
                        }`}
                    >
                      <div
                        className={`h-2 w-2 rounded-full ${isActive ? 'bg-brand-500 animate-pulse' : 'bg-subtle'
                          }`}
                      />
                    </div>

                    {/* Timeline Card */}
                    <div className="rounded-lg border border-edge bg-surface-1 p-5 transition hover:border-brand-500/40 hover:bg-surface-2/60">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-edge-subtle pb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-display font-bold text-lg text-ink">
                            {record.panel_title}
                          </span>
                          <Badge
                            variant={
                              record.term_status === 'ACTIVE'
                                ? 'success'
                                : record.term_status === 'PLANNED'
                                  ? 'info'
                                  : 'neutral'
                            }
                          >
                            Term: {record.term_status}
                          </Badge>
                        </div>

                        <div>
                          {isActive ? (
                            <Badge variant="success" dot pulse>
                              CURRENT ACTIVE APPOINTMENT
                            </Badge>
                          ) : (
                            <Badge variant="neutral">CONCLUDED TENURE</Badge>
                          )}
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                        <div className="flex items-start gap-2">
                          <Briefcase size={16} className="text-brand-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-subtle block font-mono uppercase tracking-wider">Position & Rank</span>
                            <span className="font-semibold text-sm text-ink">{record.position_name}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-subtle">Level {record.hierarchy_level}</span>
                              <span className="font-mono text-faint">({record.position_key})</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <Building2 size={16} className="text-brand-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-subtle block font-mono uppercase tracking-wider">Team Assignment</span>
                            <span className="font-semibold text-sm text-ink">
                              {record.team_name || 'Central / Club-wide'}
                            </span>
                            {record.team_key && (
                              <div className="font-mono text-faint mt-0.5">{record.team_key}</div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <Calendar size={16} className="text-brand-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-subtle block font-mono uppercase tracking-wider">Appointment Span</span>
                            <span className="font-mono text-ink font-semibold">
                              {formatDate(record.appointed_at)} →{' '}
                              {record.ended_at ? formatDate(record.ended_at) : 'Present'}
                            </span>
                            {record.notes && (
                              <div className="mt-1 text-muted italic" title={record.notes}>
                                &ldquo;{record.notes}&rdquo;
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Certificate Section */}
                      <div className="mt-4 pt-3 border-t border-edge-subtle">
                        {(() => {
                          const cert = memberCertData?.certificates?.find(
                            (c) => Number(c.panel_membership_id) === Number(record.panel_membership_id)
                          )

                          if (memberCertLoading) {
                            return (
                              <div className="flex items-center gap-2 text-xs text-muted">
                                <Award size={14} className="text-subtle animate-spin" />
                                <span>Checking certificate record...</span>
                              </div>
                            )
                          }

                          if (cert) {
                            const statusVariant =
                              cert.status === 'DELIVERED'
                                ? 'success'
                                : cert.status === 'AVAILABLE'
                                  ? 'brand'
                                  : cert.status === 'ISSUED'
                                    ? 'info'
                                    : 'neutral'

                            return (
                              <div className="rounded border border-edge bg-surface-2 p-3 text-xs space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <Award size={15} className="text-brand-400 shrink-0" />
                                    <span className="font-semibold text-ink">Executive Certificate Record</span>
                                    <span className="font-mono text-xs text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20">
                                      {cert.certificate_number}
                                    </span>
                                  </div>
                                  <Badge variant={statusVariant} dot={cert.status === 'AVAILABLE' || cert.status === 'DELIVERED'}>
                                    Status: {cert.status}
                                  </Badge>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-subtle font-mono border-t border-edge-subtle pt-2">
                                  <div>
                                    <span className="text-faint">Snapshot Preserved:</span>{' '}
                                    <span className="text-muted font-sans font-medium">
                                      {cert.member_name_snapshot} ({cert.position_snapshot})
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-faint">Snapshot Date:</span>{' '}
                                    <span className="text-muted">{formatDate(cert.snapshot_date)}</span>
                                  </div>
                                </div>

                                {cert.status === 'AVAILABLE' && (
                                  <div className="text-[11px] text-brand-400 font-mono flex items-center gap-1.5">
                                    <CheckCircle2 size={12} />
                                    <span>Certificate is validated and ready for delivery/distribution.</span>
                                  </div>
                                )}
                                {cert.status === 'DELIVERED' && (
                                  <div className="text-[11px] text-subtle font-mono flex items-center gap-1.5">
                                    <CheckCircle2 size={12} className="text-brand-400" />
                                    <span>Delivered on {formatDate(cert.delivered_at)}</span>
                                  </div>
                                )}
                              </div>
                            )
                          }

                          if (record.status === 'VOID') {
                            return (
                              <div className="flex items-center gap-2 text-xs text-subtle italic">
                                <Award size={14} className="text-faint" />
                                <span>Appointment was marked VOID — not eligible for an executive certificate.</span>
                              </div>
                            )
                          }

                          return (
                            <div className="flex items-center justify-between text-xs text-subtle rounded border border-dashed border-edge-subtle px-3 py-2 bg-surface-2/40">
                              <div className="flex items-center gap-2">
                                <Award size={14} className="text-faint" />
                                <span>No executive certificate record generated yet for this term appointment.</span>
                              </div>
                              <span className="text-[11px] font-mono text-faint">Manageable via Panel Management</span>
                            </div>
                          )
                        })()}
                      </div>

                      {/* Transition banner if subsequent term exists */}
                      {index > 0 && (
                        <div className="mt-3 pt-3 border-t border-edge-subtle flex items-center gap-2 text-xs text-brand-400 font-mono">
                          <ArrowRight size={13} />
                          <span>Historical progression preserved — successor appointment recorded in later term.</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: ASSIGN MEMBER TO PANEL ───────────────────────────────────── */}
      <Modal
        isOpen={assignModalOpen}
        title="Assign Member to Panel"
        onClose={() => setAssignModalOpen(false)}
      >
        <form onSubmit={handleAssignSubmit} className="space-y-4 text-sm">
          {assignFormError && (
            <div className="rounded border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
              {assignFormError}
            </div>
          )}

          {/* Panel Term */}
          <div>
            <label htmlFor="assign_term" className="block text-xs font-semibold uppercase tracking-wider text-subtle mb-1">
              Panel Term <span className="text-danger">*</span>
            </label>
            <select
              id="assign_term"
              required
              value={assignForm.panel_term_id}
              onChange={(e) => setAssignForm({ ...assignForm, panel_term_id: e.target.value })}
              className="w-full rounded-sm border border-edge bg-surface-1 px-3 py-2 text-ink focus:border-brand-500 focus:outline-none"
            >
              <option value="">-- Select Panel Term --</option>
              {terms
                .filter((t) => t.status !== 'ARCHIVED')
                .map((t) => (
                  <option key={t.panel_term_id} value={t.panel_term_id}>
                    {t.panel_title} ({t.status})
                  </option>
                ))}
            </select>
          </div>

          {/* Official Member */}
          <div>
            <label htmlFor="assign_member" className="block text-xs font-semibold uppercase tracking-wider text-subtle mb-1">
              Official Club Member <span className="text-danger">*</span>
            </label>
            {members.length === 0 ? (
              <div className="rounded border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
                No active official members found in core_members.
              </div>
            ) : (
              <select
                id="assign_member"
                required
                value={assignForm.member_id}
                onChange={(e) => setAssignForm({ ...assignForm, member_id: e.target.value })}
                className="w-full rounded-sm border border-edge bg-surface-1 px-3 py-2 text-ink focus:border-brand-500 focus:outline-none"
              >
                <option value="">-- Select Member --</option>
                {members.map((m) => (
                  <option key={m.member_id} value={m.member_id}>
                    {m.member_name} ({m.member_code})
                  </option>
                ))}
              </select>
            )}
            <p className="mt-1 text-[11px] text-faint">
              Must be an official AUSTRC club member (core_members), not a generic user account.
            </p>
          </div>

          {/* Position */}
          <div>
            <label htmlFor="assign_pos" className="block text-xs font-semibold uppercase tracking-wider text-subtle mb-1">
              Leadership Position <span className="text-danger">*</span>
            </label>
            <select
              id="assign_pos"
              required
              value={assignForm.position_id}
              onChange={(e) => setAssignForm({ ...assignForm, position_id: e.target.value })}
              className="w-full rounded-sm border border-edge bg-surface-1 px-3 py-2 text-ink focus:border-brand-500 focus:outline-none"
            >
              <option value="">-- Select Position --</option>
              {activePositions.map((p) => (
                <option key={p.position_id} value={p.position_id}>
                  {p.position_name} (Level {p.hierarchy_level})
                </option>
              ))}
            </select>
          </div>

          {/* Team (Optional) */}
          <div>
            <label htmlFor="assign_team" className="block text-xs font-semibold uppercase tracking-wider text-subtle mb-1">
              Functional Team <span className="text-faint">(Optional)</span>
            </label>
            <select
              id="assign_team"
              value={assignForm.team_id}
              onChange={(e) => setAssignForm({ ...assignForm, team_id: e.target.value })}
              className="w-full rounded-sm border border-edge bg-surface-1 px-3 py-2 text-ink focus:border-brand-500 focus:outline-none"
            >
              <option value="">-- None / Central Executive --</option>
              {activeTeams.map((tm) => (
                <option key={tm.team_id} value={tm.team_id}>
                  {tm.team_name} ({tm.team_key})
                </option>
              ))}
            </select>
          </div>

          {/* Appointment Date */}
          <div>
            <label htmlFor="assign_date" className="block text-xs font-semibold uppercase tracking-wider text-subtle mb-1">
              Appointment Effective Date <span className="text-danger">*</span>
            </label>
            <input
              id="assign_date"
              type="date"
              required
              value={assignForm.appointed_at}
              onChange={(e) => setAssignForm({ ...assignForm, appointed_at: e.target.value })}
              className="w-full rounded-sm border border-edge bg-surface-1 px-3 py-2 text-ink focus:border-brand-500 focus:outline-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="assign_notes" className="block text-xs font-semibold uppercase tracking-wider text-subtle mb-1">
              Notes / Resolution Ref <span className="text-faint">(Optional, max 500)</span>
            </label>
            <textarea
              id="assign_notes"
              rows={2}
              maxLength={500}
              placeholder="e.g. Appointed pursuant to AUSTRC Executive Election Resolution 2025/1"
              value={assignForm.notes}
              onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
              className="w-full rounded-sm border border-edge bg-surface-1 px-3 py-2 text-ink placeholder:text-faint focus:border-brand-500 focus:outline-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-edge-subtle">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAssignModalOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={actionLoading}>
              {actionLoading ? 'Assigning...' : 'Appoint to Panel'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── MODAL: CONCLUDE / END APPOINTMENT ───────────────────────────────── */}
      <Modal
        isOpen={endModalOpen}
        title="Conclude Panel Appointment"
        onClose={() => setEndModalOpen(false)}
      >
        <form onSubmit={handleEndSubmit} className="space-y-4 text-sm">
          {endFormError && (
            <div className="rounded border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
              {endFormError}
            </div>
          )}

          {targetMembership && (
            <div className="rounded border border-edge bg-surface-2 p-3 text-xs space-y-1">
              <div>
                <span className="text-subtle font-mono">Member: </span>
                <span className="font-semibold text-ink">{targetMembership.member_name}</span>{' '}
                <span className="font-mono text-brand-400">({targetMembership.member_code})</span>
              </div>
              <div>
                <span className="text-subtle font-mono">Position: </span>
                <span className="font-medium text-ink">{targetMembership.position_name}</span>
              </div>
              <div>
                <span className="text-subtle font-mono">Term: </span>
                <span className="text-ink">{targetMembership.panel_title}</span>
              </div>
            </div>
          )}

          <p className="text-xs text-muted">
            Concluding this appointment marks the tenure as ended as of the selected date. This record will <strong>remain permanently</strong> in the member&apos;s chronological history ledger.
          </p>

          <div>
            <label htmlFor="end_date" className="block text-xs font-semibold uppercase tracking-wider text-subtle mb-1">
              Tenure End Date <span className="text-danger">*</span>
            </label>
            <input
              id="end_date"
              type="date"
              required
              value={endForm.ended_at}
              onChange={(e) => setEndForm({ ...endForm, ended_at: e.target.value })}
              className="w-full rounded-sm border border-edge bg-surface-1 px-3 py-2 text-ink focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="end_notes" className="block text-xs font-semibold uppercase tracking-wider text-subtle mb-1">
              Conclusion Remarks <span className="text-faint">(Optional)</span>
            </label>
            <textarea
              id="end_notes"
              rows={2}
              maxLength={500}
              placeholder="e.g. Completed tenure successfully / transitioned to advisory role"
              value={endForm.notes}
              onChange={(e) => setEndForm({ ...endForm, notes: e.target.value })}
              className="w-full rounded-sm border border-edge bg-surface-1 px-3 py-2 text-ink placeholder:text-faint focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-edge-subtle">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEndModalOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={actionLoading}>
              {actionLoading ? 'Saving...' : 'Conclude Appointment'}
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  )
}
