// event-management/backend/repositories/event.repository.js
// Owner: Event Management Team
// Table: evt_events (owned by Event module per TABLE_OWNERSHIP.md)
// Rule: parameterized queries only (AGENTS.md §24).

import { query } from '../../../shared-features/backend/database/pool.js';

// Create a new event.
// Requires { name }. Everything else falls back to schema defaults.
export async function createEvent({
  name,
  description = null,
  event_type = null,
  venue = null,
  start_at = null,
  end_at = null,
  registration_open_at = null,
  registration_close_at = null,
  status = 'DRAFT',
  organizer_reference = null,
  configuration = null,
}) {
  const sql = `
    INSERT INTO evt_events (
      name, description, event_type, venue,
      start_at, end_at,
      registration_open_at, registration_close_at,
      status, organizer_reference, configuration
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING *;
  `;
  const params = [
    name, description, event_type, venue,
    start_at, end_at,
    registration_open_at, registration_close_at,
    status, organizer_reference, configuration,
  ];
  const result = await query(sql, params);
  return result.rows[0];
}

// Find one event by primary key.
export async function findEventById(eventId) {
  const sql = `SELECT * FROM evt_events WHERE event_id = $1;`;
  const result = await query(sql, [eventId]);
  return result.rows[0] || null;
}

// List events, newest first. Optional status filter.
export async function listEvents({ status = null, limit = 50, offset = 0 } = {}) {
  if (status) {
    const sql = `
      SELECT * FROM evt_events
      WHERE status = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3;
    `;
    const result = await query(sql, [status, limit, offset]);
    return result.rows;
  }
  const sql = `
    SELECT * FROM evt_events
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2;
  `;
  const result = await query(sql, [limit, offset]);
  return result.rows;
}