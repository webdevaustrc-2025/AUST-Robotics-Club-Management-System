
import { useState, useEffect } from 'react'
import {
  Calendar,
  Layers,
  UsersRound,
  Plus,
  Edit2,
  Archive,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  Award,
  ChevronRight,
  Clock,
  Download,
} from 'lucide-react'

import Badge from '../../../shared-features/frontend/components/Badge.jsx'
import Button from '../../../shared-features/frontend/components/Button.jsx'
import DataTable from '../../../shared-features/frontend/components/DataTable.jsx'
import Modal from '../../../shared-features/frontend/components/Modal.jsx'
import Loader from '../../../shared-features/frontend/components/Loader.jsx'

import usePanelTerms from '../hooks/usePanelTerms.js'
import usePositions from '../hooks/usePositions.js'
import useTeams from '../hooks/useTeams.js'
import useCertificates from '../hooks/useCertificates.js'

function slugifyKey(name) {
  if (!name) return ''
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function formatDate(val) {
  if (!val) return '—'
  // Handle ISO date string or YYYY-MM-DD
  const str = String(val).split('T')[0]
  return str
}

export default function PanelManagement() {
  const [activeTab, setActiveTab] = useState('terms') // 'terms' | 'positions' | 'teams' | 'certificates'

  // Hook data
  const {
    terms,
    loading: termsLoading,
    error: termsError,
    actionLoading: termsActionLoading,
    createTerm,
    updateTerm,
    archiveTerm,
    clearError: clearTermsError,
  } = usePanelTerms()

  const {
    positions,
    loading: positionsLoading,
    error: positionsError,
    actionLoading: positionsActionLoading,
    createPosition,
    updatePosition,
    toggleStatus: togglePositionStatus,
    clearError: clearPositionsError,
  } = usePositions()

  const {
    teams,
    loading: teamsLoading,
    error: teamsError,
    actionLoading: teamsActionLoading,
    createTeam,
    updateTeam,
    toggleStatus: toggleTeamStatus,
    clearError: clearTeamsError,
  } = useTeams()

  const {
    termCertData,
    termCertLoading,
    termCertError,
    loadCertsByTerm,
    actionLoading: certActionLoading,
    createCertificate,
    updateCertificateStatus,
    clearErrors: clearCertErrors,
  } = useCertificates()

  // Modals state
  const [termModalOpen, setTermModalOpen] = useState(false)
  const [editingTerm, setEditingTerm] = useState(null)
  const [termForm, setTermForm] = useState({
    panel_title: '',
    start_date: '',
    end_date: '',
    status: 'PLANNED',
    notes: '',
  })
  const [termFormError, setTermFormError] = useState(null)

  const [posModalOpen, setPosModalOpen] = useState(false)
  const [editingPos, setEditingPos] = useState(null)
  const [posForm, setPosForm] = useState({
    position_key: '',
    position_name: '',
    hierarchy_level: 0,
    sort_order: 0,
    can_assign_tasks: false,
    status: 'ACTIVE',
  })
  const [posKeyCustomized, setPosKeyCustomized] = useState(false)
  const [posFormError, setPosFormError] = useState(null)

  const [teamModalOpen, setTeamModalOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState(null)
  const [teamForm, setTeamForm] = useState({
    team_key: '',
    team_name: '',
    description: '',
    status: 'ACTIVE',
  })
  const [teamKeyCustomized, setTeamKeyCustomized] = useState(false)
  const [teamFormError, setTeamFormError] = useState(null)

  // Current global error
  const currentError = termsError || positionsError || teamsError || termCertError

  // Selected term for certificates tab
  const [certTermId, setCertTermId] = useState('')
  const [certSuccessMsg, setCertSuccessMsg] = useState(null)

  // Load certificates when tab is active and term is selected
  useEffect(() => {
    if (activeTab === 'certificates' && certTermId) {
      loadCertsByTerm(certTermId)
    }
  }, [activeTab, certTermId, loadCertsByTerm])

  // Auto-select the first term when switching to certificates tab
  useEffect(() => {
    if (activeTab === 'certificates' && !certTermId && terms.length > 0) {
      const activeTerm = terms.find((t) => t.status === 'ACTIVE') || terms[0]
      setCertTermId(String(activeTerm.panel_term_id))
    }
  }, [activeTab, terms, certTermId])

  const dismissError = () => {
    clearTermsError()
    clearPositionsError()
    clearTeamsError()
    clearCertErrors()
  }

  const handleIssueCertificate = async (membershipId) => {
    const res = await createCertificate({ panel_membership_id: membershipId })
    if (res.success) {
      setCertSuccessMsg('Certificate record created successfully.')
      setTimeout(() => setCertSuccessMsg(null), 4000)
      loadCertsByTerm(certTermId)
    }
  }

  const handleAdvanceCertStatus = async (certId, newStatus) => {
    const res = await updateCertificateStatus(certId, { status: newStatus })
    if (res.success) {
      setCertSuccessMsg(`Certificate status updated to ${newStatus}.`)
      setTimeout(() => setCertSuccessMsg(null), 4000)
      loadCertsByTerm(certTermId)
    }
  }

  // ── Term handlers ───────────────────────────────────────────────────────────
  const openCreateTerm = () => {
    setEditingTerm(null)
    setTermForm({
      panel_title: '',
      start_date: '',
      end_date: '',
      status: 'PLANNED',
      notes: '',
    })
    setTermFormError(null)
    setTermModalOpen(true)
  }

  const openEditTerm = (term) => {
    setEditingTerm(term)
    setTermForm({
      panel_title: term.panel_title || '',
      start_date: formatDate(term.start_date),
      end_date: formatDate(term.end_date),
      status: term.status || 'PLANNED',
      notes: term.notes || '',
    })
    setTermFormError(null)
    setTermModalOpen(true)
  }

  const handleTermSubmit = async (e) => {
    e.preventDefault()
    setTermFormError(null)

    if (!termForm.panel_title.trim()) {
      setTermFormError('Panel Title is required.')
      return
    }
    if (!termForm.start_date || !termForm.end_date) {
      setTermFormError('Both Start Date and End Date are required.')
      return
    }
    if (new Date(termForm.end_date) <= new Date(termForm.start_date)) {
      setTermFormError('End Date must be after Start Date.')
      return
    }

    let res
    if (editingTerm) {
      res = await updateTerm(editingTerm.panel_term_id, termForm)
    } else {
      res = await createTerm(termForm)
    }

    if (res.success) {
      setTermModalOpen(false)
    } else {
      setTermFormError(res.error)
    }
  }

  // ── Position handlers ───────────────────────────────────────────────────────
  const openCreatePosition = () => {
    setEditingPos(null)
    setPosForm({
      position_key: '',
      position_name: '',
      hierarchy_level: 0,
      sort_order: 0,
      can_assign_tasks: false,
      status: 'ACTIVE',
    })
    setPosKeyCustomized(false)
    setPosFormError(null)
    setPosModalOpen(true)
  }

  const openEditPosition = (pos) => {
    setEditingPos(pos)
    setPosForm({
      position_key: pos.position_key || '',
      position_name: pos.position_name || '',
      hierarchy_level: pos.hierarchy_level ?? 0,
      sort_order: pos.sort_order ?? 0,
      can_assign_tasks: Boolean(pos.can_assign_tasks),
      status: pos.status || 'ACTIVE',
    })
    setPosKeyCustomized(true)
    setPosFormError(null)
    setPosModalOpen(true)
  }

  const handlePosNameChange = (val) => {
    setPosForm((prev) => ({
      ...prev,
      position_name: val,
      position_key: posKeyCustomized ? prev.position_key : slugifyKey(val),
    }))
  }

  const handlePosSubmit = async (e) => {
    e.preventDefault()
    setPosFormError(null)

    const key = posForm.position_key.trim() || slugifyKey(posForm.position_name)
    if (!posForm.position_name.trim()) {
      setPosFormError('Position Name is required.')
      return
    }
    if (!key) {
      setPosFormError('Position Key is required.')
      return
    }

    const payload = {
      ...posForm,
      position_key: key,
      hierarchy_level: Number(posForm.hierarchy_level) || 0,
      sort_order: Number(posForm.sort_order) || 0,
    }

    let res
    if (editingPos) {
      res = await updatePosition(editingPos.position_id, payload)
    } else {
      res = await createPosition(payload)
    }

    if (res.success) {
      setPosModalOpen(false)
    } else {
      setPosFormError(res.error)
    }
  }

  // ── Team handlers ───────────────────────────────────────────────────────────
  const openCreateTeam = () => {
    setEditingTeam(null)
    setTeamForm({
      team_key: '',
      team_name: '',
      description: '',
      status: 'ACTIVE',
    })
    setTeamKeyCustomized(false)
    setTeamFormError(null)
    setTeamModalOpen(true)
  }

  const openEditTeam = (team) => {
    setEditingTeam(team)
    setTeamForm({
      team_key: team.team_key || '',
      team_name: team.team_name || '',
      description: team.description || '',
      status: team.status || 'ACTIVE',
    })
    setTeamKeyCustomized(true)
    setTeamFormError(null)
    setTeamModalOpen(true)
  }

  const handleTeamNameChange = (val) => {
    setTeamForm((prev) => ({
      ...prev,
      team_name: val,
      team_key: teamKeyCustomized ? prev.team_key : slugifyKey(val),
    }))
  }

  const handleTeamSubmit = async (e) => {
    e.preventDefault()
    setTeamFormError(null)

    const key = teamForm.team_key.trim() || slugifyKey(teamForm.team_name)
    if (!teamForm.team_name.trim()) {
      setTeamFormError('Team Name is required.')
      return
    }
    if (!key) {
      setTeamFormError('Team Key is required.')
      return
    }

    const payload = {
      ...teamForm,
      team_key: key,
    }

    let res
    if (editingTeam) {
      res = await updateTeam(editingTeam.team_id, payload)
    } else {
      res = await createTeam(payload)
    }

    if (res.success) {
      setTeamModalOpen(false)
    } else {
      setTeamFormError(res.error)
    }
  }

  // ── Columns definitions ─────────────────────────────────────────────────────

  const termColumns = [
    {
      key: 'panel_title',
      header: 'Panel Title',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-ink">{row.panel_title}</span>
          {row.notes && (
            <span className="mt-0.5 max-w-xs truncate text-xs text-subtle" title={row.notes}>
              {row.notes}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'dates',
      header: 'Term Duration',
      render: (row) => (
        <span className="font-mono text-xs text-muted">
          {formatDate(row.start_date)} → {formatDate(row.end_date)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        if (row.status === 'ACTIVE') {
          return (
            <Badge variant="success" dot pulse>
              ACTIVE
            </Badge>
          )
        }
        if (row.status === 'PLANNED') {
          return (
            <Badge variant="info" dot>
              PLANNED
            </Badge>
          )
        }
        return <Badge variant="warning">ARCHIVED</Badge>
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => openEditTerm(row)}
            aria-label={`Edit ${row.panel_title}`}
          >
            <Edit2 size={13} />
            <span>Edit</span>
          </Button>
          {row.status !== 'ARCHIVED' && (
            <Button
              size="sm"
              variant="ghost"
              disabled={termsActionLoading}
              onClick={() => {
                if (window.confirm(`Archive "${row.panel_title}"? Past panel terms remain in historical records.`)) {
                  archiveTerm(row.panel_term_id)
                }
              }}
              className="text-warning hover:bg-warning/10"
              aria-label={`Archive ${row.panel_title}`}
            >
              <Archive size={13} />
              <span>Archive</span>
            </Button>
          )}
        </div>
      ),
    },
  ]

  const posColumns = [
    {
      key: 'position_name',
      header: 'Position Name',
      render: (row) => (
        <div>
          <span className="font-medium text-ink">{row.position_name}</span>
          <div className="mt-0.5">
            <span className="font-mono text-xs text-subtle">{row.position_key}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'hierarchy_level',
      header: 'Hierarchy / Order',
      render: (row) => (
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded bg-surface-3 px-2 py-0.5 font-mono text-ink">
            Lvl {row.hierarchy_level}
          </span>
          <span className="text-subtle font-mono">Order {row.sort_order}</span>
        </div>
      ),
    },
    {
      key: 'can_assign_tasks',
      header: 'Task Authority',
      render: (row) =>
        row.can_assign_tasks ? (
          <Badge variant="success">Can Assign</Badge>
        ) : (
          <span className="text-xs text-subtle font-mono">Standard</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={row.status === 'ACTIVE' ? 'success' : 'neutral'} dot>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => openEditPosition(row)}
            aria-label={`Edit ${row.position_name}`}
          >
            <Edit2 size={13} />
            <span>Edit</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={positionsActionLoading}
            onClick={() => togglePositionStatus(row.position_id, row.status)}
            className={
              row.status === 'ACTIVE'
                ? 'text-subtle hover:text-danger hover:bg-danger/10'
                : 'text-brand-400 hover:bg-brand-500/10'
            }
          >
            {row.status === 'ACTIVE' ? (
              <>
                <XCircle size={13} />
                <span>Deactivate</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={13} />
                <span>Activate</span>
              </>
            )}
          </Button>
        </div>
      ),
    },
  ]

  const teamColumns = [
    {
      key: 'team_name',
      header: 'Team Name',
      render: (row) => (
        <div>
          <span className="font-medium text-ink">{row.team_name}</span>
          <div className="mt-0.5">
            <span className="font-mono text-xs text-subtle">{row.team_key}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => (
        <span className="max-w-md truncate text-xs text-muted block" title={row.description}>
          {row.description || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={row.status === 'ACTIVE' ? 'success' : 'neutral'} dot>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => openEditTeam(row)}
            aria-label={`Edit ${row.team_name}`}
          >
            <Edit2 size={13} />
            <span>Edit</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={teamsActionLoading}
            onClick={() => toggleTeamStatus(row.team_id, row.status)}
            className={
              row.status === 'ACTIVE'
                ? 'text-subtle hover:text-danger hover:bg-danger/10'
                : 'text-brand-400 hover:bg-brand-500/10'
            }
          >
            {row.status === 'ACTIVE' ? (
              <>
                <XCircle size={13} />
                <span>Deactivate</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={13} />
                <span>Activate</span>
              </>
            )}
          </Button>
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
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Executive Panels & Roles
          </h1>
          <p className="mt-1 text-sm text-muted">
            Configure annual panel terms, executive leadership positions, and functional teams.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'terms' && (
            <Button variant="primary" onClick={openCreateTerm}>
              <Plus size={16} />
              <span>New Panel Term</span>
            </Button>
          )}
          {activeTab === 'positions' && (
            <Button variant="primary" onClick={openCreatePosition}>
              <Plus size={16} />
              <span>New Position</span>
            </Button>
          )}
          {activeTab === 'teams' && (
            <Button variant="primary" onClick={openCreateTeam}>
              <Plus size={16} />
              <span>New Team</span>
            </Button>
          )}
        </div>
      </div>

      {/* Global error banner */}
      {currentError && (
        <div className="flex items-center justify-between rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{currentError}</span>
          </div>
          <button
            type="button"
            onClick={dismissError}
            aria-label="Dismiss"
            className="text-danger hover:opacity-80"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-edge-subtle gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('terms')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition duration-fast ${activeTab === 'terms'
              ? 'border-brand-500 text-brand-400 bg-brand-500/5'
              : 'border-transparent text-muted hover:text-ink hover:border-edge'
            }`}
        >
          <Calendar size={16} />
          <span>Panel Terms</span>
          <span className="rounded-full bg-surface-3 px-2 py-0.5 font-mono text-xs text-subtle">
            {terms.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('positions')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition duration-fast ${activeTab === 'positions'
              ? 'border-brand-500 text-brand-400 bg-brand-500/5'
              : 'border-transparent text-muted hover:text-ink hover:border-edge'
            }`}
        >
          <Layers size={16} />
          <span>Positions</span>
          <span className="rounded-full bg-surface-3 px-2 py-0.5 font-mono text-xs text-subtle">
            {positions.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('teams')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition duration-fast ${activeTab === 'teams'
              ? 'border-brand-500 text-brand-400 bg-brand-500/5'
              : 'border-transparent text-muted hover:text-ink hover:border-edge'
            }`}
        >
          <UsersRound size={16} />
          <span>Teams</span>
          <span className="rounded-full bg-surface-3 px-2 py-0.5 font-mono text-xs text-subtle">
            {teams.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('certificates')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition duration-fast ${activeTab === 'certificates'
              ? 'border-brand-500 text-brand-400 bg-brand-500/5'
              : 'border-transparent text-muted hover:text-ink hover:border-edge'
            }`}
        >
          <Award size={16} />
          <span>Certificates</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'terms' && (
          <div>
            {termsLoading ? (
              <Loader label="Loading executive panel terms..." />
            ) : (
              <DataTable
                columns={termColumns}
                rows={terms.map((t) => ({ ...t, id: t.panel_term_id }))}
                emptyMessage="No panel terms registered yet. Click 'New Panel Term' to define the first executive panel."
              />
            )}
          </div>
        )}

        {activeTab === 'positions' && (
          <div>
            {positionsLoading ? (
              <Loader label="Loading leadership positions..." />
            ) : (
              <DataTable
                columns={posColumns}
                rows={positions.map((p) => ({ ...p, id: p.position_id }))}
                emptyMessage="No positions registered yet. Click 'New Position' to configure executive titles."
              />
            )}
          </div>
        )}

        {activeTab === 'teams' && (
          <div>
            {teamsLoading ? (
              <Loader label="Loading executive teams..." />
            ) : (
              <DataTable
                columns={teamColumns}
                rows={teams.map((t) => ({ ...t, id: t.team_id }))}
                emptyMessage="No teams registered yet. Click 'New Team' to set up functional sub-teams."
              />
            )}
          </div>
        )}

        {/* ── TAB: CERTIFICATES ──────────────────────────────────────────── */}
        {activeTab === 'certificates' && (
          <div className="space-y-5">

            {/* Term selector bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-edge bg-surface-1 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-500/10 text-brand-400">
                  <Award size={20} />
                </div>
                <div>
                  <label htmlFor="cert_term_select" className="block text-[11px] font-mono uppercase tracking-wider text-subtle">
                    Panel Term — Certificate View
                  </label>
                  {terms.length === 0 ? (
                    <span className="text-sm text-muted">No terms available.</span>
                  ) : (
                    <select
                      id="cert_term_select"
                      value={certTermId}
                      onChange={(e) => setCertTermId(e.target.value)}
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
              <p className="text-xs text-muted max-w-sm">
                Issue certificate records for panel members. Actual document generation is handled by the Shared/Core pipeline (coming soon).
              </p>
            </div>

            {/* Success banner */}
            {certSuccessMsg && (
              <div className="flex items-center justify-between rounded-md border border-brand-500/40 bg-brand-500/10 px-4 py-3 text-sm text-brand-400 animate-fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0" />
                  <span>{certSuccessMsg}</span>
                </div>
                <button type="button" onClick={() => setCertSuccessMsg(null)} className="text-brand-400 hover:opacity-80">
                  <X size={16} />
                </button>
              </div>
            )}

            {termCertLoading ? (
              <Loader label="Loading certificate records for this term..." />
            ) : !certTermId ? (
              <div className="rounded-lg border border-dashed border-edge p-12 text-center">
                <Award size={36} className="mx-auto text-faint mb-3" />
                <p className="text-base font-medium text-ink">Select a Panel Term</p>
                <p className="text-sm text-subtle mt-1">Choose a panel term above to view and manage its certificate records.</p>
              </div>
            ) : (
              <div className="space-y-6">

                {/* Section A: Issued certificates */}
                <div>
                  <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
                    <Award size={15} className="text-brand-400" />
                    Issued Certificate Records
                    <span className="rounded-full bg-surface-3 px-2 py-0.5 font-mono text-xs text-subtle">
                      {termCertData?.issued?.length ?? 0}
                    </span>
                  </h3>

                  {(!termCertData?.issued || termCertData.issued.length === 0) ? (
                    <div className="rounded-lg border border-dashed border-edge py-8 text-center">
                      <Award size={28} className="mx-auto text-faint mb-2" />
                      <p className="text-sm font-medium text-ink">No certificates issued for this term yet.</p>
                      <p className="text-xs text-subtle mt-1">Use the "Issue Certificate" actions below to create records.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {termCertData.issued.map((cert) => {
                        const nextStatusMap = { PENDING: 'ISSUED', ISSUED: 'AVAILABLE', AVAILABLE: 'DELIVERED' }
                        const nextStatus = nextStatusMap[cert.status]
                        const statusVariantMap = { PENDING: 'warning', ISSUED: 'info', AVAILABLE: 'success', DELIVERED: 'neutral' }

                        return (
                          <div
                            key={cert.member_certificate_id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-edge bg-surface-1 px-4 py-3 hover:border-brand-500/30 transition"
                          >
                            <div className="flex items-start gap-3">
                              <Award size={18} className="text-brand-400 shrink-0 mt-0.5" />
                              <div>
                                <p className="font-semibold text-sm text-ink">{cert.member_name_snapshot}</p>
                                <p className="text-xs text-muted">{cert.position_snapshot}{cert.team_snapshot ? ` — ${cert.team_snapshot}` : ''}</p>
                                <p className="font-mono text-[11px] text-subtle mt-0.5">#{cert.certificate_number}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <Badge variant={statusVariantMap[cert.status] ?? 'neutral'}>
                                {cert.status}
                              </Badge>

                              {nextStatus && (
                                <button
                                  type="button"
                                  disabled={certActionLoading}
                                  onClick={() => handleAdvanceCertStatus(cert.member_certificate_id, nextStatus)}
                                  className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-brand-400 border border-brand-500/30 hover:bg-brand-500/10 transition disabled:opacity-50"
                                  aria-label={`Advance to ${nextStatus}`}
                                >
                                  <ChevronRight size={12} />
                                  {nextStatus}
                                </button>
                              )}

                              {/* Coming-soon download stub — document not yet generated */}
                              <button
                                type="button"
                                disabled
                                title="Document generation coming soon — requires Shared/Core pipeline"
                                className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-disabled border border-edge cursor-not-allowed"
                                aria-label="Download certificate (coming soon)"
                              >
                                <Download size={12} />
                                <span>Download</span>
                                <span className="text-[10px] text-faint">(Soon)</span>
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Section B: Memberships needing a certificate */}
                {termCertData?.withoutCertificate?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
                      <Clock size={15} className="text-warning" />
                      Awaiting Certificate Record
                      <span className="rounded-full bg-surface-3 px-2 py-0.5 font-mono text-xs text-subtle">
                        {termCertData.withoutCertificate.length}
                      </span>
                    </h3>

                    <div className="space-y-2">
                      {termCertData.withoutCertificate.map((m) => (
                        <div
                          key={m.panel_membership_id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-edge border-dashed bg-surface-1 px-4 py-3"
                        >
                          <div>
                            <p className="font-semibold text-sm text-ink">{m.member_name}</p>
                            <p className="text-xs text-muted">{m.position_name}{m.team_name ? ` — ${m.team_name}` : ''}</p>
                            <p className="font-mono text-[11px] text-subtle">{m.member_code}</p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant={m.membership_status === 'ACTIVE' ? 'success' : 'neutral'}>
                              {m.membership_status}
                            </Badge>
                            <button
                              type="button"
                              disabled={certActionLoading}
                              onClick={() => handleIssueCertificate(m.panel_membership_id)}
                              className="flex items-center gap-1 rounded px-3 py-1 text-xs font-semibold text-brand-400 border border-brand-500/40 hover:bg-brand-500/10 transition disabled:opacity-50"
                              aria-label={`Issue certificate for ${m.member_name}`}
                            >
                              <Award size={12} />
                              Issue Certificate Record
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* All done state */}
                {termCertData?.withoutCertificate?.length === 0 && termCertData?.issued?.length > 0 && (
                  <div className="flex items-center gap-2 rounded-md border border-brand-500/30 bg-brand-500/5 px-4 py-3 text-sm text-brand-400">
                    <CheckCircle2 size={16} />
                    <span>All panel memberships for this term have a certificate record.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal: Term Create/Edit ────────────────────────────────────────── */}
      <Modal
        isOpen={termModalOpen}
        title={editingTerm ? 'Edit Panel Term' : 'Create New Panel Term'}
        onClose={() => setTermModalOpen(false)}
      >
        <form onSubmit={handleTermSubmit} className="space-y-4 text-sm">
          {termFormError && (
            <div className="rounded border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
              {termFormError}
            </div>
          )}

          <div>
            <label htmlFor="panel_title" className="block text-xs font-semibold uppercase tracking-wider text-subtle mb-1">
              Panel Title <span className="text-danger">*</span>
            </label>
            <input
              id="panel_title"
              type="text"
              required
              maxLength={200}
              placeholder="e.g. Executive Panel 2025-2026"
              value={termForm.panel_title}
              onChange={(e) => setTermForm({ ...termForm, panel_title: e.target.value })}
              className="w-full rounded-sm border border-edge bg-surface-1 px-3 py-2 text-ink placeholder:text-faint focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="term_start_date" className="block text-xs font-semibold uppercase tracking-wider text-subtle mb-1">
                Start Date <span className="text-danger">*</span>
              </label>
              <input
                id="term_start_date"
                type="date"
                required
                value={termForm.start_date}
                onChange={(e) => setTermForm({ ...termForm, start_date: e.target.value })}
                className="w-full rounded-sm border border-edge bg-surface-1 px-3 py-2 text-ink focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="term_end_date" className="block text-xs font-semibold uppercase tracking-wider text-subtle mb-1">
                End Date <span className="text-danger">*</span>
              </label>
              <input
                id="term_end_date"
                type="date"
                required
                value={termForm.end_date}
                onChange={(e) => setTermForm({ ...termForm, end_date: e.target.value })}
                className="w-full rounded-sm border border-edge bg-surface-1 px-3 py-2 text-ink focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="term_status" className="block text-xs font-semibold uppercase tracking-wider text-subtle mb-1">
              Status
            </label>
            <select
              id="term_status"
              value={termForm.status}
              onChange={(e) => setTermForm({ ...termForm, status: e.target.value })}
              className="w-full rounded-sm border border-edge bg-surface-1 px-3 py-2 text-ink focus:border-brand-500 focus:outline-none"
            >
              <option value="PLANNED">PLANNED (Upcoming)</option>
              <option value="ACTIVE">ACTIVE (Current Serving Panel)</option>
              <option value="ARCHIVED">ARCHIVED (Past Term)</option>
            </select>
          </div>

          <div>
            <label htmlFor="term_notes" className="block text-xs font-semibold uppercase tracking-wider text-subtle mb-1">
              Notes / Description
            </label>
            <textarea
              id="term_notes"
              rows={3}
              placeholder="Optional remarks regarding this executive panel term..."
              value={termForm.notes}
              onChange={(e) => setTermForm({ ...termForm, notes: e.target.value })}
              className="w-full rounded-sm border border-edge bg-surface-1 px-3 py-2 text-ink placeholder:text-faint focus:border-brand-500 focus:outline-none resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-edge-subtle">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setTermModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={termsActionLoading}
            >
              {editingTerm ? 'Save Changes' : 'Create Term'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Position Create/Edit ────────────────────────────────────── */}
      <Modal
        isOpen={posModalOpen}
        title={editingPos ? 'Edit Executive Position' : 'Create Executive Position'}
        onClose={() => setPosModalOpen(false)}
      >
        <form onSubmit={handlePosSubmit} className="space-y-4 text-sm">
          {posFormError && (
            <div className="rounded border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
              {posFormError}
            </div>
          )}

          <div>
            <label htmlFor="position_name" className="block text-xs font-semibold uppercase tracking-wider text-subtle mb-1">
              Position Name <span className="text-danger">*</span>
            </label>
            <input
              id="position_name"
              type="text"
              required
              maxLength={150}
              placeholder="e.g. Vice President (Technical)"
              value={posForm.position_name}
              onChange={(e) => handlePosNameChange(e.target.value)}
              className="w-full rounded-sm border border-edge bg-surface-1 px-3 py-2 text-ink placeholder:text-faint focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="position_key" className="block text-xs font-semibold uppercase tracking-wider text-subtle">
                Position Key (Unique Identifier) <span className="text-danger">*</span>
              </label>
              {!posKeyCustomized && (
                <span className="font-mono text-[10px] text-brand-400">Auto-generated</span>
              )}
            </div>
            <input
              id="position_key"
              type="text"
              required
              maxLength={100}
              placeholder="e.g. VICE_PRESIDENT_TECH"
              value={posForm.position_key}
              onChange={(e) => {
                setPosKeyCustomized(true)
                setPosForm({ ...posForm, position_key: e.target.value.toUpperCase() })
              }}
              className="w-full font-mono rounded-sm border border-edge bg-surface-1 px-3 py-2 text-ink placeholder:text-faint focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="hierarchy_level" className="block text-xs font-semibold uppercase tracking-wider text-subtle mb-1">
                Hierarchy Level
              </label>
              <input
                id="hierarchy_level"
                type="number"
                min={0}
                value={posForm.hierarchy_level}
                onChange={(e) => setPosForm({ ...posForm, hierarchy_level: e.target.value })}
                className="w-full rounded-sm border border-edge bg-surface-1 px-3 py-2 text-ink focus:border-brand-500 focus:outline-none"
              />
              <span className="text-[11px] text-subtle mt-0.5 block">Higher = higher rank</span>
            </div>
            <div>
              <label htmlFor="pos_sort_order" className="block text-xs font-semibold uppercase tracking-wider text-subtle mb-1">
                Display Sort Order
              </label>
              <input
                id="pos_sort_order"
                type="number"
                min={0}
                value={posForm.sort_order}
                onChange={(e) => setPosForm({ ...posForm, sort_order: e.target.value })}
                className="w-full rounded-sm border border-edge bg-surface-1 px-3 py-2 text-ink focus:border-brand-500 focus:outline-none"
              />
              <span className="text-[11px] text-subtle mt-0.5 block">0, 1, 2, ...</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center pt-1">
            <div>
              <label htmlFor="pos_status" className="block text-xs font-semibold uppercase tracking-wider text-subtle mb-1">
                Status
              </label>
              <select
                id="pos_status"
                value={posForm.status}
                onChange={(e) => setPosForm({ ...posForm, status: e.target.value })}
                className="w-full rounded-sm border border-edge bg-surface-1 px-3 py-2 text-ink focus:border-brand-500 focus:outline-none"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>

            <div className="sm:pt-5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={posForm.can_assign_tasks}
                  onChange={(e) => setPosForm({ ...posForm, can_assign_tasks: e.target.checked })}
                  className="size-4 rounded border-edge bg-surface-1 text-brand-500 accent-brand-500"
                />
                <span className="text-xs font-medium text-ink">Can Assign Tasks</span>
              </label>
              <span className="text-[11px] text-subtle block ml-6">Grants task assignment authority</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-edge-subtle">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPosModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={positionsActionLoading}
            >
              {editingPos ? 'Save Changes' : 'Create Position'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Team Create/Edit ────────────────────────────────────────── */}
      <Modal
        isOpen={teamModalOpen}
        title={editingTeam ? 'Edit Executive Team' : 'Create Executive Team'}
        onClose={() => setTeamModalOpen(false)}
      >
        <form onSubmit={handleTeamSubmit} className="space-y-4 text-sm">
          {teamFormError && (
            <div className="rounded border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
              {teamFormError}
            </div>
          )}

          <div>
            <label htmlFor="team_name" className="block text-xs font-semibold uppercase tracking-wider text-subtle mb-1">
              Team Name <span className="text-danger">*</span>
            </label>
            <input
              id="team_name"
              type="text"
              required
              maxLength={150}
              placeholder="e.g. Software & AI Team"
              value={teamForm.team_name}
              onChange={(e) => handleTeamNameChange(e.target.value)}
              className="w-full rounded-sm border border-edge bg-surface-1 px-3 py-2 text-ink placeholder:text-faint focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="team_key" className="block text-xs font-semibold uppercase tracking-wider text-subtle">
                Team Key (Unique Identifier) <span className="text-danger">*</span>
              </label>
              {!teamKeyCustomized && (
                <span className="font-mono text-[10px] text-brand-400">Auto-generated</span>
              )}
            </div>
            <input
              id="team_key"
              type="text"
              required
              maxLength={100}
              placeholder="e.g. SOFTWARE_AI"
              value={teamForm.team_key}
              onChange={(e) => {
                setTeamKeyCustomized(true)
                setTeamForm({ ...teamForm, team_key: e.target.value.toUpperCase() })
              }}
              className="w-full font-mono rounded-sm border border-edge bg-surface-1 px-3 py-2 text-ink placeholder:text-faint focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="team_status" className="block text-xs font-semibold uppercase tracking-wider text-subtle mb-1">
              Status
            </label>
            <select
              id="team_status"
              value={teamForm.status}
              onChange={(e) => setTeamForm({ ...teamForm, status: e.target.value })}
              className="w-full rounded-sm border border-edge bg-surface-1 px-3 py-2 text-ink focus:border-brand-500 focus:outline-none"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>

          <div>
            <label htmlFor="team_description" className="block text-xs font-semibold uppercase tracking-wider text-subtle mb-1">
              Description
            </label>
            <textarea
              id="team_description"
              rows={3}
              maxLength={500}
              placeholder="Brief description of the team's operational domain..."
              value={teamForm.description}
              onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
              className="w-full rounded-sm border border-edge bg-surface-1 px-3 py-2 text-ink placeholder:text-faint focus:border-brand-500 focus:outline-none resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-edge-subtle">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setTeamModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={teamsActionLoading}
            >
              {editingTeam ? 'Save Changes' : 'Create Team'}
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  )
}
