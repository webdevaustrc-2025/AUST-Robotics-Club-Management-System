/**
 * guard.js — Safety Guard for Administration Test Suites
 * 
 * Preload module (--import) that prevents tests from running against non-test databases.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Pure verification logic for the guard (exported for unit testing)
 */
export function verifySafetyGuard({ nodeEnv, testDbUrl, devEnvContent }) {
  if (nodeEnv !== 'test') {
    throw new Error(
      `[DATABASE SAFETY GUARD] Refusal: NODE_ENV must be "test" (received "${nodeEnv}").`
    )
  }

  if (!testDbUrl || typeof testDbUrl !== 'string' || !testDbUrl.trim()) {
    throw new Error(
      '[DATABASE SAFETY GUARD] Refusal: Test DATABASE_URL is not set or empty.'
    )
  }

  let testUrlParsed
  try {
    testUrlParsed = new URL(testDbUrl)
  } catch (err) {
    throw new Error(
      `[DATABASE SAFETY GUARD] Refusal: Test DATABASE_URL is not a valid URL: ${err.message}`
    )
  }

  if (devEnvContent) {
    // Parse DATABASE_URL line from .env content without loading it into process.env
    const match = devEnvContent.match(/^\s*DATABASE_URL\s*=\s*(.+)$/m)
    if (match && match[1]) {
      let devDbUrl = match[1].trim()
      // Strip surrounding quotes if present
      if (
        (devDbUrl.startsWith('"') && devDbUrl.endsWith('"')) ||
        (devDbUrl.startsWith("'") && devDbUrl.endsWith("'"))
      ) {
        devDbUrl = devDbUrl.slice(1, -1)
      }

      try {
        const devUrlParsed = new URL(devDbUrl)
        if (
          testUrlParsed.host.toLowerCase() === devUrlParsed.host.toLowerCase() &&
          testUrlParsed.pathname.toLowerCase() === devUrlParsed.pathname.toLowerCase()
        ) {
          throw new Error(
            `[DATABASE SAFETY GUARD] REFUSAL: Test DATABASE_URL (${testUrlParsed.host}${testUrlParsed.pathname}) matches the host and database in .env! Running tests against the development/production database is strictly prohibited.`
          )
        }
      } catch (err) {
        if (err.message.includes('[DATABASE SAFETY GUARD]')) {
          throw err
        }
        // If .env contains placeholder or unparseable URL, pass through
      }
    }
  }

  return true
}

/**
 * Self-executing guard when imported as a preload
 */
function runGuard() {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../')
  const devEnvPath = path.join(rootDir, '.env')

  let devEnvContent = null
  if (fs.existsSync(devEnvPath)) {
    try {
      devEnvContent = fs.readFileSync(devEnvPath, 'utf8')
    } catch {
      // Ignore read errors
    }
  }

  try {
    verifySafetyGuard({
      nodeEnv: process.env.NODE_ENV,
      testDbUrl: process.env.DATABASE_URL,
      devEnvContent,
    })
  } catch (err) {
    console.error('\n' + '='.repeat(80))
    console.error(err.message)
    console.error('='.repeat(80) + '\n')
    process.exit(1)
  }
}

// Only run automatically when executed directly or preloaded via --import
const isPreloadOrDirect =
  process.execArgv.some((arg) => arg.includes('guard.js')) ||
  (process.argv[1] && process.argv[1].endsWith('guard.js'))

if (isPreloadOrDirect) {
  runGuard()
}
