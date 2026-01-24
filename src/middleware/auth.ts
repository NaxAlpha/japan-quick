import { MiddlewareHandler } from 'hono'
import type { Env } from '../types/news.js'
import { log } from '../lib/logger.js'

export const basicAuth = (): MiddlewareHandler<{
  Bindings: Env['Bindings']
}> => {
  return async (c, next) => {
    const path = c.req.path
    const authHeader = c.req.header('Authorization')
    const hasUsername = authHeader ? 'present' : 'missing'

    log.auth.info('Auth attempt', { path, hasUsername })

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      log.auth.error('Auth failed: Missing or invalid Authorization header', { path })
      return unauthorized(c)
    }

    try {
      const credentials = atob(authHeader.substring(6))
      const [username, password] = credentials.split(':')

      if (!username || !password) {
        log.auth.error('Auth failed: Missing username or password in credentials', { path, username: !!username })
        return unauthorized(c)
      }

      const validUsername = c.env.ADMIN_USERNAME
      const validPassword = c.env.ADMIN_PASSWORD

      if (username !== validUsername || password !== validPassword) {
        log.auth.error('Auth failed: Invalid credentials', { path, username })
        return unauthorized(c)
      }

      log.auth.info('Auth success', { path, username })
      await next()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      log.auth.error('Auth error: Malformed credentials', { path, error: message })
      return unauthorized(c)
    }
  }
}

function unauthorized(c: any) {
  return c.json(
    { error: 'Unauthorized', message: 'Valid authentication required' },
    401,
    { 'WWW-Authenticate': 'Basic realm="Japan Quick"' }
  )
}
