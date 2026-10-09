/**
 * fixtures.js — Test Fixtures Generator
 * 
 * Creates and cleans up isolated test worlds in the test database.
 * Columns derived strictly from database/schema/current_schema.sql.
 */

export const LADDER_SPECS = [
  { key: 'PRESIDENT', name: 'President', level: 100, canAssign: true },
  { key: 'VICE_PRESIDENT', name: 'Vice President', level: 90, canAssign: true },
  { key: 'GEN_SEC', name: 'General Secretary', level: 80, canAssign: true },
  { key: 'JOINT_SEC', name: 'Joint Secretary', level: 70, canAssign: true },
  { key: 'DIRECTOR', name: 'Director', level: 50, canAssign: true },
  { key: 'ASST_DIR', name: 'Assistant Director', level: 40, canAssign: true },
  { key: 'DEPUTY_EXEC', name: 'Deputy Executive', level: 30, canAssign: true },
  { key: 'SR_SUB_EXEC', name: 'Senior Sub Executive', level: 20, canAssign: true },
  { key: 'SUB_EXEC', name: 'Sub Executive', level: 10, canAssign: false },
  { key: 'UNRANKED', name: 'Unranked Position', level: 0, canAssign: false },
  { key: 'ADVISOR', name: 'Advisor Position', level: 95, canAssign: false },
]


/**
 * Creates a complete isolated test world with a unique runId prefix.
 */
export async function createWorld(client, runId) {
  if (!runId || typeof runId !== 'string') {
    throw new Error('createWorld requires a unique string runId')
  }

  // 1. Create Active Term and Other Term
  const termRes = await client.query(
    `INSERT INTO adm_panel_terms (panel_title, start_date, end_date, status)
     VALUES ($1, '2026-01-01', '2026-12-31', 'ACTIVE')
     RETURNING panel_term_id, panel_title, start_date, end_date, status`,
    [`${runId}_ACTIVE_TERM`]
  )
  const activeTerm = termRes.rows[0]

  const otherTermRes = await client.query(
    `INSERT INTO adm_panel_terms (panel_title, start_date, end_date, status)
     VALUES ($1, '2025-01-01', '2025-12-31', 'COMPLETED')
     RETURNING panel_term_id, panel_title, start_date, end_date, status`,
    [`${runId}_OTHER_TERM`]
  )
  const otherTerm = otherTermRes.rows[0]

  // 2. Create Teams A and B
  const teamARes = await client.query(
    `INSERT INTO adm_teams (team_key, team_name, description, status)
     VALUES ($1, $2, 'Test Team A', 'ACTIVE')
     RETURNING team_id, team_key, team_name`,
    [`${runId}_TEAM_A`, `${runId} Team A`]
  )
  const teamA = teamARes.rows[0]

  const teamBRes = await client.query(
    `INSERT INTO adm_teams (team_key, team_name, description, status)
     VALUES ($1, $2, 'Test Team B', 'ACTIVE')
     RETURNING team_id, team_key, team_name`,
    [`${runId}_TEAM_B`, `${runId} Team B`]
  )
  const teamB = teamBRes.rows[0]

  // 3. Create Position Ladder
  const positions = {}
  for (const spec of LADDER_SPECS) {
    const posKey = `${runId}_${spec.key}`
    const posName = `${runId} ${spec.name}`
    const res = await client.query(
      `INSERT INTO adm_positions (position_key, position_name, hierarchy_level, sort_order, can_assign_tasks, status)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
       RETURNING position_id, position_key, position_name, hierarchy_level, sort_order, can_assign_tasks, status`,
      [posKey, posName, spec.level, spec.level, spec.canAssign]
    )
    positions[spec.key] = res.rows[0]
  }

  // 4. Helper to create user + member
  async function createActorUserAndMember(alias) {
    const email = `${runId}_${alias.toLowerCase()}@test.austrc.local`
    const userRes = await client.query(
      `INSERT INTO core_users (email, password_hash, auth_provider, status)
       VALUES ($1, 'hash_test', 'LOCAL', 'ACTIVE')
       RETURNING user_id, email, status`,
      [email]
    )
    const user = userRes.rows[0]

    const memberRes = await client.query(
      `INSERT INTO core_members (user_id, member_code, member_name, primary_email, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')
       RETURNING member_id, user_id, member_code, member_name, primary_email, status`,
      [user.user_id, `${runId}_MEM_${alias}`, `${runId} Member ${alias}`, email]
    )
    const member = memberRes.rows[0]

    return { user, member }
  }

  // 5. Build Actor accounts & memberships
  const actors = {}

  async function registerActor({
    alias,
    posKey,
    team = teamA,
    term = activeTerm,
    status = 'ACTIVE',
    endedAt = null,
    hasMembership = true,
  }) {
    const { user, member } = await createActorUserAndMember(alias)
    let membership = null

    if (hasMembership && posKey) {
      const position = positions[posKey]
      const memRes = await client.query(
        `INSERT INTO adm_panel_memberships (panel_term_id, member_id, position_id, team_id, appointed_at, ended_at, status, notes)
         VALUES ($1, $2, $3, $4, '2026-01-15', $5, $6, $7)
         RETURNING panel_membership_id, panel_term_id, member_id, position_id, team_id, appointed_at, ended_at, status`,
        [term.panel_term_id, member.member_id, position.position_id, team.team_id, endedAt, status, `${runId} membership`]
      )
      membership = memRes.rows[0]
    }

    const actor = {
      alias,
      user,
      member,
      membership,
      position: posKey ? positions[posKey] : null,
      team,
      term,
    }

    actors[alias] = actor
    return actor
  }

  await registerActor({ alias: 'PRESIDENT', posKey: 'PRESIDENT', team: teamA })
  await registerActor({ alias: 'VICE_PRESIDENT', posKey: 'VICE_PRESIDENT', team: teamA })
  await registerActor({ alias: 'GENERAL_SECRETARY', posKey: 'GEN_SEC', team: teamA })
  await registerActor({ alias: 'JOINT_SECRETARY', posKey: 'JOINT_SEC', team: teamA })
  await registerActor({ alias: 'DIRECTOR', posKey: 'DIRECTOR', team: teamA })
  await registerActor({ alias: 'DIRECTOR_2', posKey: 'DIRECTOR', team: teamB })
  await registerActor({ alias: 'ASSISTANT_DIRECTOR', posKey: 'ASST_DIR', team: teamA })
  await registerActor({ alias: 'MANAGER', posKey: 'ASST_DIR', team: teamA })
  await registerActor({ alias: 'DEPUTY_EXECUTIVE', posKey: 'DEPUTY_EXEC', team: teamA })
  await registerActor({ alias: 'SENIOR_SUB', posKey: 'SR_SUB_EXEC', team: teamA })
  await registerActor({ alias: 'SUB_EXEC', posKey: 'SUB_EXEC', team: teamA })
  await registerActor({ alias: 'MANAGER_LOW', posKey: 'SUB_EXEC', team: teamA })
  await registerActor({ alias: 'ADVISOR_ACTOR', posKey: 'ADVISOR', team: teamA })
  await registerActor({ alias: 'ADMIN_NO_MEMBERSHIP', hasMembership: false })
  await registerActor({ alias: 'NO_MEMBERSHIP', hasMembership: false })
  await registerActor({ alias: 'UNRANKED', posKey: 'UNRANKED', team: teamA })

  // DUAL actor: two active memberships in active term: Sub Exec (10) and Assistant Director (40)
  const dualBase = await createActorUserAndMember('DUAL')
  const dualSubExecMem = await client.query(
    `INSERT INTO adm_panel_memberships (panel_term_id, member_id, position_id, team_id, appointed_at, ended_at, status, notes)
     VALUES ($1, $2, $3, $4, '2026-01-15', NULL, 'ACTIVE', $5)
     RETURNING panel_membership_id, panel_term_id, member_id, position_id, team_id, appointed_at, ended_at, status`,
    [activeTerm.panel_term_id, dualBase.member.member_id, positions['SUB_EXEC'].position_id, teamA.team_id, `${runId} dual sub_exec`]
  )
  const dualAsstDirMem = await client.query(
    `INSERT INTO adm_panel_memberships (panel_term_id, member_id, position_id, team_id, appointed_at, ended_at, status, notes)
     VALUES ($1, $2, $3, $4, '2026-02-01', NULL, 'ACTIVE', $5)
     RETURNING panel_membership_id, panel_term_id, member_id, position_id, team_id, appointed_at, ended_at, status`,
    [activeTerm.panel_term_id, dualBase.member.member_id, positions['ASST_DIR'].position_id, teamA.team_id, `${runId} dual asst_dir`]
  )
  actors['DUAL'] = {
    alias: 'DUAL',
    user: dualBase.user,
    member: dualBase.member,
    membership: dualAsstDirMem.rows[0], // primary / highest
    subExecMembership: dualSubExecMem.rows[0],
    asstDirMembership: dualAsstDirMem.rows[0],
    team: teamA,
    term: activeTerm,
  }

  // INACTIVE actor: ended/inactive membership (Sub Exec level)
  await registerActor({
    alias: 'INACTIVE',
    posKey: 'SUB_EXEC',
    team: teamA,
    status: 'INACTIVE',
    endedAt: '2026-01-20',
  })

  // OTHER_TERM actor: Sub Executive in the other term
  await registerActor({
    alias: 'OTHER_TERM',
    posKey: 'SUB_EXEC',
    team: teamA,
    term: otherTerm,
  })

  // Set aliases for backwards compatibility with tests
  actors.LEADER = actors.DIRECTOR
  actors.OUTSIDER = actors.DEPUTY_EXECUTIVE
  actors.ASSIGNEE_A = actors.SENIOR_SUB
  actors.ASSIGNEE_B = actors.SUB_EXEC

  return {
    runId,
    activeTerm,
    otherTerm,
    teamA,
    teamB,
    teams: { TEAM_A: teamA, TEAM_B: teamB },
    positions,
    actors,
  }
}

/**
 * Reverses FK dependencies and cleans up all fixture rows carrying the runId prefix.
 */
export async function cleanupWorld(client, runId) {
  if (!runId || typeof runId !== 'string') return

  // 1. Task status history
  await client.query(
    `DELETE FROM adm_task_status_history
     WHERE task_id IN (
       SELECT task_id FROM adm_tasks
       WHERE task_title LIKE $1
          OR panel_term_id IN (SELECT panel_term_id FROM adm_panel_terms WHERE panel_title LIKE $1)
     )`,
    [`${runId}%`]
  )

  // 2. Task assignees
  await client.query(
    `DELETE FROM adm_task_assignees
     WHERE task_id IN (
       SELECT task_id FROM adm_tasks
       WHERE task_title LIKE $1
          OR panel_term_id IN (SELECT panel_term_id FROM adm_panel_terms WHERE panel_title LIKE $1)
     )
     OR panel_membership_id IN (
       SELECT panel_membership_id FROM adm_panel_memberships
       WHERE notes LIKE $1
          OR panel_term_id IN (SELECT panel_term_id FROM adm_panel_terms WHERE panel_title LIKE $1)
     )`,
    [`${runId}%`]
  )

  // 3. Tasks
  await client.query(
    `DELETE FROM adm_tasks
     WHERE task_title LIKE $1
        OR panel_term_id IN (SELECT panel_term_id FROM adm_panel_terms WHERE panel_title LIKE $1)`,
    [`${runId}%`]
  )

  // 4. Panel memberships
  await client.query(
    `DELETE FROM adm_panel_memberships
     WHERE notes LIKE $1
        OR panel_term_id IN (SELECT panel_term_id FROM adm_panel_terms WHERE panel_title LIKE $1)
        OR member_id IN (SELECT member_id FROM core_members WHERE member_code LIKE $1)`,
    [`${runId}%`]
  )

  // 5. Positions
  await client.query(
    `DELETE FROM adm_positions
     WHERE position_key LIKE $1`,
    [`${runId}%`]
  )

  // 6. Teams
  await client.query(
    `DELETE FROM adm_teams
     WHERE team_key LIKE $1`,
    [`${runId}%`]
  )

  // 7. Panel terms
  await client.query(
    `DELETE FROM adm_panel_terms
     WHERE panel_title LIKE $1`,
    [`${runId}%`]
  )

  // 8. Core members
  await client.query(
    `DELETE FROM core_members
     WHERE member_code LIKE $1`,
    [`${runId}%`]
  )

  // 9. Core users
  await client.query(
    `DELETE FROM core_users
     WHERE email LIKE $1`,
    [`${runId}%`]
  )
}

/**
 * Helper to update position rank for a membership (simulating promotion/demotion for H4 tests).
 */
export async function setPositionRank(client, membershipId, positionId) {
  const res = await client.query(
    `UPDATE adm_panel_memberships
     SET position_id = $1, updated_at = CURRENT_TIMESTAMP
     WHERE panel_membership_id = $2
     RETURNING *`,
    [positionId, membershipId]
  )
  return res.rows[0]
}
