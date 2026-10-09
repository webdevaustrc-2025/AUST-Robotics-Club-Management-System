/**
 * devServer.js — Standalone Dev Server for Admin Tasks
 * 
 * Runs a standalone test harness server with injected fake auth.
 * Strictly verifies the safety guard before listening.
 * NEVER import this file into root server/app.js.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTestApp } from '../helpers/testApp.js'
import { verifySafetyGuard } from '../setup/guard.js'

// 1. Verify Safety Guard
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../')
const devEnvPath = path.join(rootDir, '.env')
let devEnvContent = null
if (fs.existsSync(devEnvPath)) {
  try {
    devEnvContent = fs.readFileSync(devEnvPath, 'utf8')
  } catch {
    // Ignore
  }
}

try {
  verifySafetyGuard({
    nodeEnv: process.env.NODE_ENV || 'test',
    testDbUrl: process.env.DATABASE_URL,
    devEnvContent,
  })
} catch (err) {
  console.error('\n' + '='.repeat(80))
  console.error('[DEV SERVER REFUSAL] Safety guard failed:')
  console.error(err.message)
  console.error('='.repeat(80) + '\n')
  process.exit(1)
}

const PORT = process.env.PORT || 5001
const { app } = createTestApp()

const server = app.listen(PORT, () => {
  console.log(`\n==================================================`)
  console.log(` Admin Tasks Standalone Dev Server Running`)
  console.log(` Address: http://localhost:${PORT}`)
  console.log(` Base API: http://localhost:${PORT}/api/administration/tasks`)
  console.log(` Database: Isolated Test Database Verified`)
  console.log(` Header auth: pass 'x-acting-user-id' or 'x-test-user-id'`)
  console.log(`==================================================\n`)
})

process.on('SIGTERM', () => server.close())
process.on('SIGINT', () => server.close())
