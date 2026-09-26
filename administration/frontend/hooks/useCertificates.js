/**
 * useCertificates — React hook for adm_member_certificates
 *
 * Mirrors the pattern of useMemberships.js exactly.
 * Provides state and callbacks for:
 *   - loading certificates by term (issued list + memberships without one)
 *   - loading certificate history for a specific member
 *   - creating a certificate record
 *   - updating a certificate's status
 */

import { useState, useCallback } from 'react'
import certificateApi from '../services/certificateApi.js'

export default function useCertificates() {
  // Per-term state: { term, issued: [], withoutCertificate: [] }
  const [termCertData, setTermCertData] = useState(null)
  const [termCertLoading, setTermCertLoading] = useState(false)
  const [termCertError, setTermCertError] = useState(null)

  // Per-member state: { member, certificates: [] }
  const [memberCertData, setMemberCertData] = useState(null)
  const [memberCertLoading, setMemberCertLoading] = useState(false)
  const [memberCertError, setMemberCertError] = useState(null)

  // Shared action state
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState(null)

  const clearErrors = useCallback(() => {
    setTermCertError(null)
    setMemberCertError(null)
    setActionError(null)
  }, [])

  /**
   * Load all certificate records for a panel term.
   * Returns both issued certificates and memberships that still need one.
   * @param {number|string} termId
   */
  const loadCertsByTerm = useCallback(async (termId) => {
    if (!termId) {
      setTermCertData(null)
      return
    }
    setTermCertLoading(true)
    setTermCertError(null)
    try {
      const res = await certificateApi.getByTerm(termId)
      setTermCertData(res?.data ?? null)
    } catch (err) {
      let msg = 'Failed to load certificate records for this term.'
      try {
        const parsed = JSON.parse(err.message)
        msg = parsed.error || msg
      } catch {
        msg = err.message || msg
      }
      setTermCertError(msg)
      setTermCertData(null)
    } finally {
      setTermCertLoading(false)
    }
  }, [])

  /**
   * Load all certificate records for a specific member.
   * @param {number|string} memberId
   */
  const loadCertsByMember = useCallback(async (memberId) => {
    if (!memberId) {
      setMemberCertData(null)
      return
    }
    setMemberCertLoading(true)
    setMemberCertError(null)
    try {
      const res = await certificateApi.getByMember(memberId)
      setMemberCertData(res?.data ?? null)
    } catch (err) {
      let msg = 'Failed to load certificate history for this member.'
      try {
        const parsed = JSON.parse(err.message)
        msg = parsed.error || msg
      } catch {
        msg = err.message || msg
      }
      setMemberCertError(msg)
      setMemberCertData(null)
    } finally {
      setMemberCertLoading(false)
    }
  }, [])

  /**
   * Create a certificate record for a given panel_membership_id.
   * @param {{ panel_membership_id: number }} payload
   * @returns {{ success: boolean, data?: object, error?: string }}
   */
  const createCertificate = useCallback(async (payload) => {
    setActionLoading(true)
    setActionError(null)
    try {
      const res = await certificateApi.create(payload)
      return { success: true, data: res?.data }
    } catch (err) {
      let msg = 'Failed to create certificate record.'
      try {
        const parsed = JSON.parse(err.message)
        msg = parsed.error || (parsed.details ? parsed.details.join(' ') : msg)
      } catch {
        msg = err.message || msg
      }
      setActionError(msg)
      return { success: false, error: msg }
    } finally {
      setActionLoading(false)
    }
  }, [])

  /**
   * Advance a certificate's status.
   * @param {number|string} id
   * @param {{ status: string }} payload
   * @returns {{ success: boolean, data?: object, error?: string }}
   */
  const updateCertificateStatus = useCallback(async (id, payload) => {
    setActionLoading(true)
    setActionError(null)
    try {
      const res = await certificateApi.updateStatus(id, payload)
      return { success: true, data: res?.data }
    } catch (err) {
      let msg = 'Failed to update certificate status.'
      try {
        const parsed = JSON.parse(err.message)
        msg = parsed.error || (parsed.details ? parsed.details.join(' ') : msg)
      } catch {
        msg = err.message || msg
      }
      setActionError(msg)
      return { success: false, error: msg }
    } finally {
      setActionLoading(false)
    }
  }, [])

  return {
    // Per-term
    termCertData,
    termCertLoading,
    termCertError,
    loadCertsByTerm,

    // Per-member
    memberCertData,
    memberCertLoading,
    memberCertError,
    loadCertsByMember,

    // Actions
    actionLoading,
    actionError,
    clearErrors,
    createCertificate,
    updateCertificateStatus,
  }
}
