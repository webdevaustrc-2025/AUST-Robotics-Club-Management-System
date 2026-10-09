/**
 * f1.eligibleAssignees.test.js — Integration Suite for F1: Eligible Assignees
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { setupIntegrationTest } from '../helpers/testDb.js'
import { ERROR_CODES } from '../../constants/taskConstants.js'

describe('F1: Eligible Assignees Endpoint (GET /eligible-assignees)', () => {
  let testEnv

  before(async () => {
    testEnv = await setupIntegrationTest('f1')
  })

  after(async () => {
    if (testEnv && !testEnv.skipped) {
      await testEnv.cleanup()
    }
  })

  it('F1-T1 DIRECTOR sees lower ranks, excluding peers, self, inactive, and other term', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv
    const termId = world.activeTerm.panel_term_id

    const res = await httpClient
      .asUser(world.actors.DIRECTOR.user.user_id)
      .get(`/api/administration/tasks/eligible-assignees?panel_term_id=${termId}`)

    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.data))

    const returnedMemberIds = res.body.data.map((m) => m.student_id)
    // Should contain junior roles
    assert.ok(returnedMemberIds.includes(world.actors.ASSISTANT_DIRECTOR.member.member_code))
    assert.ok(returnedMemberIds.includes(world.actors.DEPUTY_EXECUTIVE.member.member_code))
    assert.ok(returnedMemberIds.includes(world.actors.SENIOR_SUB.member.member_code))
    assert.ok(returnedMemberIds.includes(world.actors.SUB_EXEC.member.member_code))

    // Should NOT contain self, peer director, inactive, or other term
    assert.ok(!returnedMemberIds.includes(world.actors.DIRECTOR.member.member_code))
    assert.ok(!returnedMemberIds.includes(world.actors.DIRECTOR_2.member.member_code))
    assert.ok(!returnedMemberIds.includes(world.actors.INACTIVE.member.member_code))
    assert.ok(!returnedMemberIds.includes(world.actors.OTHER_TERM.member.member_code))
  })

  it('F1-T2 Per level the eligible list shrinks strictly with rank', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv
    const termId = world.activeTerm.panel_term_id

    // Senior Sub (rank 20) can only see Sub Exec (rank 10)
    const resSr = await httpClient
      .asUser(world.actors.SENIOR_SUB.user.user_id)
      .get(`/api/administration/tasks/eligible-assignees?panel_term_id=${termId}`)
    assert.equal(resSr.status, 200)
    const srCodes = resSr.body.data.map((m) => m.student_id)
    assert.ok(srCodes.includes(world.actors.SUB_EXEC.member.member_code))
    assert.ok(!srSrIncludesHigher(srCodes, world))
  })

  function srSrIncludesHigher(codes, world) {
    return (
      codes.includes(world.actors.DIRECTOR.member.member_code) ||
      codes.includes(world.actors.ASSISTANT_DIRECTOR.member.member_code) ||
      codes.includes(world.actors.DEPUTY_EXECUTIVE.member.member_code)
    )
  }

  it('F1-T3 team_id filter narrows results without widening beyond hierarchy', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv
    const termId = world.activeTerm.panel_term_id
    const teamAId = world.teamA.team_id

    const res = await httpClient
      .asUser(world.actors.DIRECTOR.user.user_id)
      .get(`/api/administration/tasks/eligible-assignees?panel_term_id=${termId}&team_id=${teamAId}`)

    assert.equal(res.status, 200)
    for (const item of res.body.data) {
      assert.equal(item.team_id, teamAId)
    }
  })

  it('F1-T4 Returns exact contract fields with numeric IDs and no sensitive fields', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv
    const termId = world.activeTerm.panel_term_id

    const res = await httpClient
      .asUser(world.actors.DIRECTOR.user.user_id)
      .get(`/api/administration/tasks/eligible-assignees?panel_term_id=${termId}`)

    assert.equal(res.status, 200)
    assert.ok(res.body.data.length > 0)
    const item = res.body.data[0]
    assert.equal(typeof item.panel_membership_id, 'number')
    assert.equal(typeof item.panel_term_id, 'number')
    assert.equal(typeof item.member_name, 'string')
    assert.equal(item.email, undefined)
    assert.equal(item.password_hash, undefined)
  })

  it('F1-T5 DUAL is evaluated at highest membership', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv
    const termId = world.activeTerm.panel_term_id

    // DUAL holds Sub Exec (10) and Assistant Director (40) -> evaluates at 40
    const res = await httpClient
      .asUser(world.actors.DUAL.user.user_id)
      .get(`/api/administration/tasks/eligible-assignees?panel_term_id=${termId}`)

    assert.equal(res.status, 200)
    const codes = res.body.data.map((m) => m.student_id)
    assert.ok(codes.includes(world.actors.DEPUTY_EXECUTIVE.member.member_code))
    assert.ok(codes.includes(world.actors.SENIOR_SUB.member.member_code))
    assert.ok(codes.includes(world.actors.SUB_EXEC.member.member_code))
  })

  it('F1-T6 UNRANKED actor returns 403 POSITION_NOT_IN_HIERARCHY and target never appears', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv
    const termId = world.activeTerm.panel_term_id

    // UNRANKED actor -> 403
    const res = await httpClient
      .asUser(world.actors.UNRANKED.user.user_id)
      .get(`/api/administration/tasks/eligible-assignees?panel_term_id=${termId}`)
    assert.equal(res.status, 403)
    assert.equal(res.body.error.code, ERROR_CODES.POSITION_NOT_IN_HIERARCHY)

    // Director list should NOT contain UNRANKED target
    const dirRes = await httpClient
      .asUser(world.actors.DIRECTOR.user.user_id)
      .get(`/api/administration/tasks/eligible-assignees?panel_term_id=${termId}`)
    const codes = dirRes.body.data.map((m) => m.student_id)
    assert.ok(!codes.includes(world.actors.UNRANKED.member.member_code))
  })

  it('F1-T7 NO_MEMBERSHIP and ADMIN_NO_MEMBERSHIP return 403 NO_ACTIVE_MEMBERSHIP', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv
    const termId = world.activeTerm.panel_term_id

    const res1 = await httpClient
      .asUser(world.actors.NO_MEMBERSHIP.user.user_id)
      .get(`/api/administration/tasks/eligible-assignees?panel_term_id=${termId}`)
    assert.equal(res1.status, 403)
    assert.equal(res1.body.error.code, ERROR_CODES.NO_ACTIVE_MEMBERSHIP)

    const res2 = await httpClient
      .asUser(world.actors.ADMIN_NO_MEMBERSHIP.user.user_id)
      .get(`/api/administration/tasks/eligible-assignees?panel_term_id=${termId}`)
    assert.equal(res2.status, 403)
    assert.equal(res2.body.error.code, ERROR_CODES.NO_ACTIVE_MEMBERSHIP)
  })

  it('F1-T8 Invalid panel_term_id returns 400; unknown term returns 403 NO_ACTIVE_MEMBERSHIP', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv

    const resBad = await httpClient
      .asUser(world.actors.DIRECTOR.user.user_id)
      .get('/api/administration/tasks/eligible-assignees?panel_term_id=abc')
    assert.equal(resBad.status, 400)

    const resUnknown = await httpClient
      .asUser(world.actors.DIRECTOR.user.user_id)
      .get('/api/administration/tasks/eligible-assignees?panel_term_id=999999')
    assert.equal(resUnknown.status, 403)
    assert.equal(resUnknown.body.error.code, ERROR_CODES.NO_ACTIVE_MEMBERSHIP)
  })

  it('F1-T9 Unauthenticated returns 401; missing permission returns 403', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv
    const termId = world.activeTerm.panel_term_id

    const unauth = await httpClient.unauthenticated.get(
      `/api/administration/tasks/eligible-assignees?panel_term_id=${termId}`
    )
    assert.equal(unauth.status, 401)

    const noPerm = await httpClient
      .asUser(world.actors.DIRECTOR.user.user_id, ['other.permission'])
      .get(`/api/administration/tasks/eligible-assignees?panel_term_id=${termId}`)
    assert.equal(noPerm.status, 403)
  })

  it('F1-T10 Route order does not capture /eligible-assignees into /:taskId', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv
    const termId = world.activeTerm.panel_term_id

    const res = await httpClient
      .asUser(world.actors.DIRECTOR.user.user_id)
      .get(`/api/administration/tasks/eligible-assignees?panel_term_id=${termId}`)
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.data))
  })

  it('F1-T11 ADVISOR_ACTOR (can_assign_tasks = false) returns 403 CANNOT_ASSIGN_TASKS', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv
    const termId = world.activeTerm.panel_term_id

    const res = await httpClient
      .asUser(world.actors.ADVISOR_ACTOR.user.user_id)
      .get(`/api/administration/tasks/eligible-assignees?panel_term_id=${termId}`)
    assert.equal(res.status, 403)
    assert.equal(res.body.error.code, ERROR_CODES.CANNOT_ASSIGN_TASKS)
  })
})
