import db from '../../../shared-features/backend/database/db.js'
import { getFileById } from '../../../shared-features/backend/files/fileService.js'

// In-memory store for development/offline preview when DATABASE_URL is not set
const mockSubmissionsStore = []

export async function findTaskById(taskId) {
  const numericTaskId = parseInt(taskId, 10)
  if (!process.env.DATABASE_URL) {
    return {
      task_id: numericTaskId,
      task_title: numericTaskId === 2 ? 'Sponsor Deck Revision' : 'Design Autonomous Line Follower PCB',
      task_description: numericTaskId === 2 
        ? 'Update financial projection slides in executive proposal.' 
        : 'Complete the schematic and layout routing for line follower v2.',
      priority: numericTaskId === 2 ? 'MEDIUM' : 'HIGH',
      status: numericTaskId === 2 ? 'TODO' : 'IN_PROGRESS',
      due_at: new Date().toISOString(),
      team_name: numericTaskId === 2 ? 'Corporate Team' : 'Hardware Team',
    }
  }

  const result = await db.query('SELECT * FROM adm_tasks WHERE task_id = $1', [numericTaskId])
  return result.rows[0] || null
}

export async function findAssigneeForUserAndTask(userId, taskId) {
  const numericTaskId = parseInt(taskId, 10)
  const numericUserId = parseInt(userId, 10)

  if (!process.env.DATABASE_URL) {
    return {
      task_assignee_id: numericTaskId,
      task_id: numericTaskId,
      panel_membership_id: 1,
      assigned_by_user_id: 1,
      status: 'ASSIGNED',
    }
  }

  const queryText = `
    SELECT ta.task_assignee_id, ta.task_id, ta.panel_membership_id, ta.status
    FROM adm_task_assignees ta
    JOIN adm_panel_memberships pm ON ta.panel_membership_id = pm.panel_membership_id
    JOIN core_members cm ON pm.member_id = cm.member_id
    WHERE ta.task_id = $1 AND cm.user_id = $2
  `
  const result = await db.query(queryText, [numericTaskId, numericUserId])
  return result.rows[0] || null
}

export async function isUserTaskAssignerOrReviewer(userId, taskId) {
  const numericTaskId = parseInt(taskId, 10)
  const numericUserId = parseInt(userId, 10)

  if (!process.env.DATABASE_URL) {
    return true
  }

  const queryText = `
    SELECT t.task_id
    FROM adm_tasks t
    JOIN adm_panel_memberships pm ON t.assigner_membership_id = pm.panel_membership_id
    JOIN core_members cm ON pm.member_id = cm.member_id
    WHERE t.task_id = $1 AND cm.user_id = $2
  `
  const result = await db.query(queryText, [numericTaskId, numericUserId])
  return result.rows.length > 0
}

export async function getNextVersionNumber(taskAssigneeId) {
  const numericAssigneeId = parseInt(taskAssigneeId, 10)

  if (!process.env.DATABASE_URL) {
    const existing = mockSubmissionsStore.filter(
      (s) => parseInt(s.task_assignee_id, 10) === numericAssigneeId
    )
    if (existing.length === 0) return 1
    const maxVersion = Math.max(...existing.map((s) => parseInt(s.version_no, 10) || 0))
    return maxVersion + 1
  }

  const queryText = `
    SELECT COALESCE(MAX(version_no), 0) + 1 AS next_version
    FROM adm_task_submissions
    WHERE task_assignee_id = $1
  `
  const result = await db.query(queryText, [numericAssigneeId])
  return parseInt(result.rows[0].next_version, 10)
}

export async function createSubmissionRecord({ taskAssigneeId, versionNo, submissionText, submissionLink }) {
  const numericAssigneeId = parseInt(taskAssigneeId, 10)
  const numericVersionNo = parseInt(versionNo, 10)

  if (!process.env.DATABASE_URL) {
    const newSub = {
      task_submission_id: Date.now() + Math.floor(Math.random() * 1000),
      task_assignee_id: numericAssigneeId,
      task_id: numericAssigneeId,
      version_no: numericVersionNo,
      submission_text: submissionText || '',
      submission_link: submissionLink || '',
      status: 'SUBMITTED',
      submitted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      submitter_name: 'Authenticated Assignee',
      submitter_code: 'AUSTRC-MEMBER',
      files: [],
      reviews: [],
    }
    mockSubmissionsStore.unshift(newSub)
    return newSub
  }

  const queryText = `
    INSERT INTO adm_task_submissions (
      task_assignee_id,
      version_no,
      submission_text,
      submission_link,
      status
    )
    VALUES ($1, $2, $3, $4, 'SUBMITTED')
    RETURNING task_submission_id, task_assignee_id, version_no, submission_text, submission_link, status, submitted_at, created_at, updated_at
  `
  const result = await db.query(queryText, [
    numericAssigneeId,
    numericVersionNo,
    submissionText || null,
    submissionLink || null,
  ])
  return result.rows[0]
}

export async function attachFilesToSubmission(taskSubmissionId, fileIds) {
  if (!fileIds || fileIds.length === 0) return []
  const numericSubId = parseInt(taskSubmissionId, 10)

  if (!process.env.DATABASE_URL) {
    const sub = mockSubmissionsStore.find((s) => parseInt(s.task_submission_id, 10) === numericSubId)
    const attached = []
    for (const fileId of fileIds) {
      const record = await getFileById(fileId)
      attached.push(
        record
          ? {
              file_id: record.file_id,
              original_name: record.original_name,
              public_url: record.public_url,
              mime_type: record.mime_type,
              file_size_bytes: record.file_size_bytes,
            }
          : {
              file_id: fileId,
              original_name: `file_${fileId}`,
              public_url: null,
              mime_type: 'application/octet-stream',
              file_size_bytes: null,
            }
      )
    }
    if (sub) {
      sub.files = [...(sub.files || []), ...attached]
    }
    return attached
  }

  const insertedFiles = []
  for (const fileId of fileIds) {
    const queryText = `
      INSERT INTO adm_task_submission_files (task_submission_id, file_id)
      VALUES ($1, $2)
      ON CONFLICT (task_submission_id, file_id) DO NOTHING
      RETURNING task_submission_file_id, task_submission_id, file_id
    `
    const result = await db.query(queryText, [numericSubId, fileId])
    if (result.rows.length > 0) {
      insertedFiles.push(result.rows[0])
    }
  }
  return insertedFiles
}

export async function createReviewRecord({ taskSubmissionId, reviewerUserId, reviewStatus, remarks }) {
  const numericSubId = parseInt(taskSubmissionId, 10)

  if (!process.env.DATABASE_URL) {
    const sub = mockSubmissionsStore.find((s) => parseInt(s.task_submission_id, 10) === numericSubId)
    const newReview = {
      task_submission_review_id: Date.now(),
      task_submission_id: numericSubId,
      reviewer_user_id: reviewerUserId,
      review_status: reviewStatus,
      remarks: remarks || null,
      reviewed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      reviewer_name: 'Lead Reviewer',
    }
    if (sub) {
      sub.status = reviewStatus
      sub.reviews = [newReview, ...(sub.reviews || [])]
    }
    return newReview
  }

  const queryText = `
    INSERT INTO adm_task_submission_reviews (
      task_submission_id,
      reviewer_user_id,
      review_status,
      remarks
    )
    VALUES ($1, $2, $3, $4)
    RETURNING task_submission_review_id, task_submission_id, reviewer_user_id, review_status, remarks, reviewed_at, created_at
  `
  const result = await db.query(queryText, [
    numericSubId,
    reviewerUserId,
    reviewStatus,
    remarks || null,
  ])
  return result.rows[0]
}

export async function updateSubmissionStatus(taskSubmissionId, status) {
  const numericSubId = parseInt(taskSubmissionId, 10)

  if (!process.env.DATABASE_URL) {
    const sub = mockSubmissionsStore.find((s) => parseInt(s.task_submission_id, 10) === numericSubId)
    if (sub) sub.status = status
    return
  }

  const queryText = `
    UPDATE adm_task_submissions
    SET status = $2, updated_at = CURRENT_TIMESTAMP
    WHERE task_submission_id = $1
  `
  await db.query(queryText, [numericSubId, status])
}

export async function updateTaskStatus(taskId, status, completedAt = null) {
  const numericTaskId = parseInt(taskId, 10)

  if (!process.env.DATABASE_URL) return

  const queryText = `
    UPDATE adm_tasks
    SET status = $2, completed_at = $3, updated_at = CURRENT_TIMESTAMP
    WHERE task_id = $1
  `
  await db.query(queryText, [numericTaskId, status, completedAt])
}

export async function getReviewsForSubmission(taskSubmissionId) {
  const numericSubId = parseInt(taskSubmissionId, 10)

  if (!process.env.DATABASE_URL) {
    const sub = mockSubmissionsStore.find((s) => parseInt(s.task_submission_id, 10) === numericSubId)
    return sub ? sub.reviews || [] : []
  }

  const queryText = `
    SELECT 
      tsr.task_submission_review_id,
      tsr.task_submission_id,
      tsr.reviewer_user_id,
      tsr.review_status,
      tsr.remarks,
      tsr.reviewed_at,
      cm.member_name AS reviewer_name
    FROM adm_task_submission_reviews tsr
    LEFT JOIN core_members cm ON tsr.reviewer_user_id = cm.user_id
    WHERE tsr.task_submission_id = $1
    ORDER BY tsr.reviewed_at DESC
  `
  const result = await db.query(queryText, [numericSubId])
  return result.rows
}

export async function getSubmissionHistoryForTask(taskId) {
  const numericTaskId = parseInt(taskId, 10)

  if (!process.env.DATABASE_URL) {
    return mockSubmissionsStore
      .filter((s) => parseInt(s.task_assignee_id, 10) === numericTaskId)
      .sort((a, b) => b.version_no - a.version_no)
  }

  const queryText = `
    SELECT 
      ts.task_submission_id,
      ts.task_assignee_id,
      ts.version_no,
      ts.submission_text,
      ts.submission_link,
      ts.status,
      ts.submitted_at,
      COALESCE(cm.member_name, 'Assignee') AS submitter_name,
      cm.member_code AS submitter_code,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'file_id', f.file_id,
            'original_name', f.original_name,
            'public_url', f.public_url,
            'mime_type', f.mime_type,
            'file_size_bytes', f.file_size_bytes
          )
        ) FILTER (WHERE f.file_id IS NOT NULL),
        '[]'
      ) AS files,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'task_submission_review_id', r.task_submission_review_id,
            'reviewer_user_id', r.reviewer_user_id,
            'review_status', r.review_status,
            'remarks', r.remarks,
            'reviewed_at', r.reviewed_at,
            'reviewer_name', COALESCE(r_cm.member_name, 'Reviewer')
          )
        ) FILTER (WHERE r.task_submission_review_id IS NOT NULL),
        '[]'
      ) AS reviews
    FROM adm_task_submissions ts
    JOIN adm_task_assignees ta ON ts.task_assignee_id = ta.task_assignee_id
    LEFT JOIN adm_panel_memberships pm ON ta.panel_membership_id = pm.panel_membership_id
    LEFT JOIN core_members cm ON pm.member_id = cm.member_id
    LEFT JOIN adm_task_submission_files tsf ON ts.task_submission_id = tsf.task_submission_id
    LEFT JOIN infra_files f ON tsf.file_id = f.file_id
    LEFT JOIN adm_task_submission_reviews r ON ts.task_submission_id = r.task_submission_id
    LEFT JOIN core_members r_cm ON r.reviewer_user_id = r_cm.user_id
    WHERE ta.task_id = $1
    GROUP BY ts.task_submission_id, cm.member_name, cm.member_code
    ORDER BY ts.version_no DESC
  `
  const result = await db.query(queryText, [numericTaskId])
  return result.rows
}

export async function getSubmissionById(submissionId) {
  const numericSubId = parseInt(submissionId, 10)

  if (!process.env.DATABASE_URL) {
    const sub = mockSubmissionsStore.find((s) => parseInt(s.task_submission_id, 10) === numericSubId)
    return sub || null
  }

  const queryText = `
    SELECT 
      ts.task_submission_id,
      ts.task_assignee_id,
      ts.version_no,
      ts.submission_text,
      ts.submission_link,
      ts.status,
      ts.submitted_at,
      ta.task_id,
      COALESCE(cm.member_name, 'Assignee') AS submitter_name,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'file_id', f.file_id,
            'original_name', f.original_name,
            'public_url', f.public_url,
            'mime_type', f.mime_type,
            'file_size_bytes', f.file_size_bytes
          )
        ) FILTER (WHERE f.file_id IS NOT NULL),
        '[]'
      ) AS files,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'task_submission_review_id', r.task_submission_review_id,
            'reviewer_user_id', r.reviewer_user_id,
            'review_status', r.review_status,
            'remarks', r.remarks,
            'reviewed_at', r.reviewed_at,
            'reviewer_name', COALESCE(r_cm.member_name, 'Reviewer')
          )
        ) FILTER (WHERE r.task_submission_review_id IS NOT NULL),
        '[]'
      ) AS reviews
    FROM adm_task_submissions ts
    JOIN adm_task_assignees ta ON ts.task_assignee_id = ta.task_assignee_id
    LEFT JOIN adm_panel_memberships pm ON ta.panel_membership_id = pm.panel_membership_id
    LEFT JOIN core_members cm ON pm.member_id = cm.member_id
    LEFT JOIN adm_task_submission_files tsf ON ts.task_submission_id = tsf.task_submission_id
    LEFT JOIN infra_files f ON tsf.file_id = f.file_id
    LEFT JOIN adm_task_submission_reviews r ON ts.task_submission_id = r.task_submission_id
    LEFT JOIN core_members r_cm ON r.reviewer_user_id = r_cm.user_id
    WHERE ts.task_submission_id = $1
    GROUP BY ts.task_submission_id, ta.task_id, cm.member_name
  `
  const result = await db.query(queryText, [numericSubId])
  return result.rows[0] || null
}

export async function listTasksForUser(userId) {
  const numericUserId = parseInt(userId, 10)

  if (!process.env.DATABASE_URL) {
    return [
      {
        task_id: 1,
        task_title: 'Design Autonomous Line Follower PCB',
        task_description: 'Complete the schematic and layout routing for line follower v2.',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        due_at: '2026-10-15T00:00:00Z',
        team_name: 'Hardware Team',
      },
      {
        task_id: 2,
        task_title: 'Sponsor Deck Revision',
        task_description: 'Update financial projection slides in executive proposal.',
        priority: 'MEDIUM',
        status: 'TODO',
        due_at: '2026-10-20T00:00:00Z',
        team_name: 'Corporate Team',
      },
    ]
  }

  const queryText = `
    SELECT DISTINCT
      t.task_id,
      t.task_title,
      t.task_description,
      t.priority,
      t.status,
      t.due_at,
      tm.team_name,
      ta.task_assignee_id,
      ta.status AS assignee_status,
      (cm.user_id = $1) AS is_assignee
    FROM adm_tasks t
    JOIN adm_teams tm ON t.team_id = tm.team_id
    LEFT JOIN adm_task_assignees ta ON t.task_id = ta.task_id
    LEFT JOIN adm_panel_memberships pm ON ta.panel_membership_id = pm.panel_membership_id
    LEFT JOIN core_members cm ON pm.member_id = cm.member_id
    LEFT JOIN adm_panel_memberships assigner_pm ON t.assigner_membership_id = assigner_pm.panel_membership_id
    LEFT JOIN core_members assigner_cm ON assigner_pm.member_id = assigner_cm.member_id
    WHERE cm.user_id = $1 OR assigner_cm.user_id = $1
    ORDER BY t.task_id DESC
  `
  const result = await db.query(queryText, [numericUserId])
  return result.rows
}
