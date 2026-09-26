import db from '../database/db.js'

/**
 * Authentication middleware to populate req.user.
 * Development fallback is strictly restricted to NODE_ENV === 'development'.
 */
export async function authenticateUser(req, res, next) {
  try {
    const isDevelopment = process.env.NODE_ENV === 'development'
    const userIdHeader = req.headers['x-user-id']
    const authHeader = req.headers.authorization

    let userId = null

    if (isDevelopment && userIdHeader) {
      const parsed = parseInt(userIdHeader, 10)
      if (!isNaN(parsed)) {
        userId = parsed
      }
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1]
      const parsed = parseInt(token, 10)
      if (!isNaN(parsed)) {
        userId = parsed
      }
    }

    if (userId && !isNaN(userId)) {
      if (process.env.DATABASE_URL) {
        const result = await db.query('SELECT user_id, email, status FROM core_users WHERE user_id = $1', [userId])
        if (result.rows.length > 0) {
          req.user = result.rows[0]
        } else if (isDevelopment) {
          req.user = { user_id: userId, email: `user_${userId}@aust.edu`, status: 'ACTIVE' }
        } else {
          req.user = null
        }
      } else if (isDevelopment) {
        req.user = { user_id: userId, email: `user_${userId}@aust.edu`, status: 'ACTIVE' }
      } else {
        req.user = null
      }
    } else if (isDevelopment) {
      // Development-only fallback user
      req.user = { user_id: 1, email: 'demo_user@aust.edu', status: 'ACTIVE' }
    } else {
      req.user = null
    }

    next()
  } catch (error) {
    next(error)
  }
}

/**
 * Middleware ensuring an authenticated user is present.
 */
export function requireAuth(req, res, next) {
  if (!req.user || !req.user.user_id) {
    return res.status(401).json({ status: 'error', error: 'Unauthorized: Authentication required' })
  }
  next()
}
