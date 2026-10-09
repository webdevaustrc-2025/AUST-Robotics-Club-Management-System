/**
 * http.js — HTTP Client Wrapper for Test Suites
 * 
 * Provides asUser(userId, perms) helper wrapping global fetch.
 * Returns { status, body, headers } and never throws on 4xx/5xx HTTP responses.
 */

export function createHttpClient(baseUrl) {
  async function request(path, options = {}) {
    const url = new URL(path, baseUrl).toString()
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    let body
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      try {
        body = await response.json()
      } catch {
        body = null
      }
    } else {
      body = await response.text()
    }

    return {
      status: response.status,
      headers: response.headers,
      body,
    }
  }

  return {
    asUser(userId, perms = ['adm.task.create']) {
      const authHeaders = {}
      if (userId !== undefined && userId !== null) {
        authHeaders['x-test-user-id'] = String(userId)
      }
      if (perms) {
        authHeaders['x-test-perms'] = Array.isArray(perms) ? perms.join(',') : String(perms)
      }

      return {
        get: (path, opts = {}) =>
          request(path, { ...opts, method: 'GET', headers: { ...authHeaders, ...opts.headers } }),
        post: (path, data, opts = {}) =>
          request(path, {
            ...opts,
            method: 'POST',
            body: data !== undefined ? JSON.stringify(data) : undefined,
            headers: { ...authHeaders, ...opts.headers },
          }),
        patch: (path, data, opts = {}) =>
          request(path, {
            ...opts,
            method: 'PATCH',
            body: data !== undefined ? JSON.stringify(data) : undefined,
            headers: { ...authHeaders, ...opts.headers },
          }),
        delete: (path, opts = {}) =>
          request(path, { ...opts, method: 'DELETE', headers: { ...authHeaders, ...opts.headers } }),
      }
    },
    // Raw unauthenticated client
    unauthenticated: {
      get: (path, opts = {}) => request(path, { ...opts, method: 'GET' }),
      post: (path, data, opts = {}) =>
        request(path, {
          ...opts,
          method: 'POST',
          body: data !== undefined ? JSON.stringify(data) : undefined,
        }),
      patch: (path, data, opts = {}) =>
        request(path, {
          ...opts,
          method: 'PATCH',
          body: data !== undefined ? JSON.stringify(data) : undefined,
        }),
      delete: (path, opts = {}) => request(path, { ...opts, method: 'DELETE' }),
    },
  }
}
