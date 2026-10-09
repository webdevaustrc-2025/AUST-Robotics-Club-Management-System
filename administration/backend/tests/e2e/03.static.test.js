/**
 * 03.static.test.js — Phase B4 Cross-Cutting: Static Source Scans
 *
 * X4: Module boundary scan — no import of event-management; no evt_ token; .query() only in repositories/
 * X5: SQL-safety scan — no ${...} template literals inside .query() calls except the allowlisted column builder
 * X10: No position name hardcoding in production source under administration/backend/ (excluding tests)
 *
 * These tests run against source files on disk — no test database required.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join, extname, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// tests/e2e/ → ../../ → administration/backend/
const ADM_BACKEND = join(__dirname, '..', '..')


/**
 * Walks a directory tree and returns all .js files matching filter.
 */
async function walkJs(dir, filter = () => true) {
  const files = []
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkJs(full, filter)))
    } else if (entry.isFile() && extname(entry.name) === '.js' && filter(full)) {
      files.push(full)
    }
  }
  return files
}

/**
 * Returns true if the path is under the tests/ directory.
 */
function isTestFile(absPath) {
  return absPath.includes('/tests/')
}

/**
 * Returns true if the path is under the repositories/ directory.
 */
function isRepositoryFile(absPath) {
  return absPath.includes('/repositories/')
}

/**
 * Returns true if the path is under utils/withTransaction.js (allowed to call .query for BEGIN/COMMIT/ROLLBACK).
 */
function isTransactionHelper(absPath) {
  return absPath.endsWith('utils/withTransaction.js')
}

describe('B4: X4 Module Boundary Scan', () => {
  test('X4-a: No import from event-management in administration/backend/', async () => {
    // Exclude test files: they may legitimately reference 'event-management' as a scan pattern string
    const files = await walkJs(ADM_BACKEND, (f) => !isTestFile(f))
    const violations = []

    for (const file of files) {
      const content = await readFile(file, 'utf8')
      // Check for any import/require statement pointing to event-management
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const trimmed = line.trim()
        // Only flag actual import/require statements — not scan comments or string patterns
        if (
          (trimmed.startsWith('import ') || trimmed.startsWith('require(')) &&
          line.includes('event-management')
        ) {
          violations.push({ file: relative(ADM_BACKEND, file), line: i + 1, content: trimmed })
        }
      }
    }

    assert.deepEqual(
      violations,
      [],
      `X4-a: found event-management imports in administration/backend/:\n${JSON.stringify(violations, null, 2)}`
    )
  })

  test('X4-b: No evt_ table names in administration/backend/ production source', async () => {
    const files = await walkJs(ADM_BACKEND, (f) => !isTestFile(f))
    const violations = []

    for (const file of files) {
      const content = await readFile(file, 'utf8')
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Match evt_ as a standalone token (table name prefix)
        if (/\bevt_/.test(line)) {
          violations.push({ file: relative(ADM_BACKEND, file), line: i + 1, content: line.trim() })
        }
      }
    }

    assert.deepEqual(
      violations,
      [],
      `X4-b: found evt_ table references in production source:\n${JSON.stringify(violations, null, 2)}`
    )
  })

  test('X4-c: .query() calls only in repositories/, taskAccess.js, and withTransaction.js (not in controllers/ or business services)', async () => {
    const files = await walkJs(ADM_BACKEND, (f) => !isTestFile(f))
    const violations = []

    for (const file of files) {
      // Skip allowlisted locations:
      // - repositories/ (primary data access layer)
      // - withTransaction.js (BEGIN/COMMIT/ROLLBACK only)
      // - taskAccess.js (thin access-context helper — membership resolution query)
      if (
        isRepositoryFile(file) ||
        isTransactionHelper(file) ||
        file.endsWith('services/taskAccess.js')
      ) continue

      const content = await readFile(file, 'utf8')
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Look for direct .query( calls — allow pool.query only in DB connection file
        if (/\.query\s*\(/.test(line) && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
          violations.push({ file: relative(ADM_BACKEND, file), line: i + 1, content: line.trim() })
        }
      }
    }

    assert.deepEqual(
      violations,
      [],
      `X4-c: .query() calls found outside repositories/ in production source:\n${JSON.stringify(violations, null, 2)}`
    )
  })
})

describe('B4: X5 SQL Safety Scan — No Template Literal Injection in .query() Calls', () => {
  test('X5: No ${...} inside .query() calls in production source (except allowlisted column builder)', async () => {
    const files = await walkJs(ADM_BACKEND, (f) => !isTestFile(f))
    const violations = []

    for (const file of files) {
      const content = await readFile(file, 'utf8')

      // Find all .query( usages and check if any contain template literal interpolations
      // Strategy: look for backtick strings with ${ in lines adjacent to .query(
      // We allow: the column name builder in taskRepository.js (setClauses.push / conditions.push)
      const allowlistedFile = file.endsWith('repositories/taskRepository.js')

      // Simple heuristic: scan for template literal .query(`...${...}...`)
      // A real AST parser is better, but this catches obvious cases
      const lines = content.split('\n')
      let inQuery = false
      let queryDepth = 0
      let queryStartLine = 0

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        // Detect start of .query( call
        if (/\.query\s*\(/.test(line)) {
          inQuery = true
          queryDepth = 0
          queryStartLine = i + 1
        }

        if (inQuery) {
          // Count backtick template strings with interpolations
          // Match: `...${...}...` pattern on same line
          if (/`[^`]*\$\{/.test(line)) {
            // Check it's not just a column name variable (allowlisted pattern in taskRepository)
            const isAllowlisted =
              allowlistedFile &&
              (line.includes('setClauses.push') ||
                line.includes('conditions.push') ||
                line.includes(`\${params.length}`) ||
                line.includes(`\${limitIdx}`) ||
                line.includes(`\${offsetIdx}`) ||
                line.includes(`\${conditions.join`) ||
                line.includes(`\${whereClause}`) ||
                line.includes(`\${setClauses.join`) ||
                line.includes(`\${teamFilter}`))

            if (!isAllowlisted) {
              violations.push({
                file: relative(ADM_BACKEND, file),
                line: i + 1,
                content: line.trim(),
              })
            }
          }

          // Track end of query call
          if (line.includes(')')) {
            inQuery = false
          }
        }
      }
    }

    assert.deepEqual(
      violations,
      [],
      `X5: found template literal interpolations in .query() calls:\n${JSON.stringify(violations, null, 2)}`
    )
  })
})

describe('B4: X10 No Position Name Hardcoding in Production Source', () => {
  // The real production ladder position names that must NOT appear as literals
  const POSITION_NAMES_TO_REJECT = [
    'President',
    'Vice President',
    'General Secretary',
    'Joint Secretary',
    'Director',
    'Assistant Director',
    'Deputy Executive',
    'Senior Sub Executive',
    'Sub Executive',
    'Unranked Position',
  ]

  test('X10: Position names do not appear as string literals in production source', async () => {
    const files = await walkJs(ADM_BACKEND, (f) => !isTestFile(f))
    const violations = []

    for (const file of files) {
      const content = await readFile(file, 'utf8')
      const lines = content.split('\n')

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Skip comments
        const trimmed = line.trim()
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue

        for (const posName of POSITION_NAMES_TO_REJECT) {
          // Detect string literal usage: 'Director', "Director", `Director`
          if (
            line.includes(`'${posName}'`) ||
            line.includes(`"${posName}"`) ||
            // Also catch backtick literal (not interpolation context)
            line.includes(`\`${posName}\``)
          ) {
            violations.push({
              file: relative(ADM_BACKEND, file),
              line: i + 1,
              posName,
              content: trimmed,
            })
          }
        }
      }
    }

    assert.deepEqual(
      violations,
      [],
      `X10: position name string literals found in production source:\n${JSON.stringify(violations, null, 2)}`
    )
  })
})
