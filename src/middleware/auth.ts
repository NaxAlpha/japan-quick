import { MiddlewareHandler } from 'hono'

type Env = {
  Bindings: {
    ADMIN_USERNAME: string
    ADMIN_PASSWORD: string
  }
}

export const basicAuth = (): MiddlewareHandler<{
  Bindings: Env['Bindings']
}> => {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization')

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return unauthorized(c)
    }

    try {
      const credentials = atob(authHeader.substring(6))
      const [username, password] = credentials.split(':')

      if (!username || !password) {
        return unauthorized(c)
      }

      const validUsername = c.env.ADMIN_USERNAME
      const validPassword = c.env.ADMIN_PASSWORD

      if (username !== validUsername || password !== validPassword) {
        return unauthorized(c)
      }

      await next()
    } catch {
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
