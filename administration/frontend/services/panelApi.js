import apiClient from '../../../shared-features/frontend/services/apiClient.js'

export const panelApi = {
  // ── Panel Terms ─────────────────────────────────────────────────────────────
  getTerms: () => apiClient.get('/administration/panel-terms'),
  getTermById: (id) => apiClient.get(`/administration/panel-terms/${id}`),
  createTerm: (data) => apiClient.post('/administration/panel-terms', data),
  updateTerm: (id, data) => apiClient.patch(`/administration/panel-terms/${id}`, data),
  archiveTerm: (id) => apiClient.patch(`/administration/panel-terms/${id}/archive`),

  // ── Positions ───────────────────────────────────────────────────────────────
  getPositions: () => apiClient.get('/administration/positions'),
  getPositionById: (id) => apiClient.get(`/administration/positions/${id}`),
  createPosition: (data) => apiClient.post('/administration/positions', data),
  updatePosition: (id, data) => apiClient.patch(`/administration/positions/${id}`, data),
  setPositionStatus: (id, status) => apiClient.patch(`/administration/positions/${id}/status`, { status }),

  // ── Teams ───────────────────────────────────────────────────────────────────
  getTeams: () => apiClient.get('/administration/teams'),
  getTeamById: (id) => apiClient.get(`/administration/teams/${id}`),
  createTeam: (data) => apiClient.post('/administration/teams', data),
  updateTeam: (id, data) => apiClient.patch(`/administration/teams/${id}`, data),
  setTeamStatus: (id, status) => apiClient.patch(`/administration/teams/${id}/status`, { status }),
}

export default panelApi
