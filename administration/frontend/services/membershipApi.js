import apiClient from '../../../shared-features/frontend/services/apiClient.js'

export const membershipApi = {
  // Official Club Members (for appointment picker)
  getMembers: (search = '') =>
    apiClient.get(`/administration/members${search ? `?search=${encodeURIComponent(search)}` : ''}`),

  // Term Roster
  getRosterByTerm: (termId, includeVoid = false) =>
    apiClient.get(`/administration/panel-memberships/term/${termId}${includeVoid ? '?includeVoid=true' : ''}`),

  // Member History Ledger
  getHistoryByMember: (memberId) =>
    apiClient.get(`/administration/panel-memberships/member/${memberId}`),

  // Single membership detail
  getMembershipById: (id) =>
    apiClient.get(`/administration/panel-memberships/${id}`),

  // Mutations
  assignMember: (data) =>
    apiClient.post('/administration/panel-memberships', data),

  endMembership: (id, data) =>
    apiClient.patch(`/administration/panel-memberships/${id}/end`, data),

  voidMembership: (id, data) =>
    apiClient.patch(`/administration/panel-memberships/${id}/void`, data),
}

export default membershipApi
