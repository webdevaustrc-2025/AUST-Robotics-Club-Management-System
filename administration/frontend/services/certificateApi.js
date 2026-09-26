/**
 * Certificate API client — adm_member_certificates
 * Mirrors the pattern of membershipApi.js exactly.
 */

import apiClient from '../../../shared-features/frontend/services/apiClient.js'

export const certificateApi = {
  // ── Read ────────────────────────────────────────────────────────────────────

  /** Get a single certificate record by its primary key */
  getById: (id) =>
    apiClient.get(`/administration/certificates/${id}`),

  /** List certificate records for a panel term + memberships without one */
  getByTerm: (termId) =>
    apiClient.get(`/administration/certificates/term/${termId}`),

  /** List all certificate records for a member across all terms */
  getByMember: (memberId) =>
    apiClient.get(`/administration/certificates/member/${memberId}`),

  // ── Mutations ────────────────────────────────────────────────────────────────

  /** Create a certificate record from a panel_membership_id */
  create: (data) =>
    apiClient.post('/administration/certificates', data),

  /** Advance certificate status: PENDING → ISSUED → AVAILABLE → DELIVERED */
  updateStatus: (id, data) =>
    apiClient.patch(`/administration/certificates/${id}/status`, data),
}

export default certificateApi
