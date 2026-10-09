import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { verifySafetyGuard } from '../setup/guard.js'

describe('Safety Guard (verifySafetyGuard)', () => {
  it('passes when NODE_ENV is test and testDbUrl differs from devEnvContent', () => {
    const ok = verifySafetyGuard({
      nodeEnv: 'test',
      testDbUrl: 'postgresql://postgres:pass@localhost:5432/austrc_test',
      devEnvContent: 'DATABASE_URL=postgresql://postgres:pass@localhost:5432/austrc_prod\n',
    })
    assert.equal(ok, true)
  })

  it('refuses when NODE_ENV is not test', () => {
    assert.throws(
      () =>
        verifySafetyGuard({
          nodeEnv: 'development',
          testDbUrl: 'postgresql://postgres:pass@localhost:5432/austrc_test',
          devEnvContent: '',
        }),
      /NODE_ENV must be "test"/
    )
  })

  it('refuses when testDbUrl is missing or empty', () => {
    assert.throws(
      () =>
        verifySafetyGuard({
          nodeEnv: 'test',
          testDbUrl: '',
          devEnvContent: '',
        }),
      /Test DATABASE_URL is not set or empty/
    )
  })

  it('refuses when testDbUrl matches devEnvContent host and database', () => {
    assert.throws(
      () =>
        verifySafetyGuard({
          nodeEnv: 'test',
          testDbUrl: 'postgresql://testuser:pass@ep-cool-branch.neon.tech/austrc_db?sslmode=require',
          devEnvContent:
            'DATABASE_URL="postgresql://produser:secret@ep-cool-branch.neon.tech/austrc_db?sslmode=require"\n',
        }),
      /REFUSAL: Test DATABASE_URL .* matches the host and database in \.env/
    )
  })
})
