/**
 * JWT Authentication Middleware
 * Validates JWT tokens on protected routes
 */

import { MiddlewareHandler } from 'hono';
import type { Env } from '../types/env.js';
import { verifyToken } from '../services/jwt-auth.js';
import { log } from '../lib/logger.js';

export const jwtAuth = (): MiddlewareHandler<{
  Bindings: Env['Bindings'];
}> => {
  return async (c, next) => {
    const path = c.req.path;

    // Skip JWT auth for public auth routes only (login, logout)
    // /api/auth/me requires valid token for validation
    const publicAuthRoutes = ['/api/auth/login', '/api/auth/logout'];
    if (publicAuthRoutes.includes(path)) {
      await next();
      return;
    }

    const authHeader = c.req.header('Authorization');
    const hasAuthHeader = authHeader ? 'present' : 'missing';

    log.auth.info('JWT auth attempt', { path, hasAuthHeader });

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      log.auth.error('JWT auth failed: Missing or invalid Authorization header', { path });
      return unauthorized(c, 'Missing authentication token');
    }

    const token = authHeader.substring(7);

    // Verify token
    const payload = await verifyToken(token, c.env);

    if (!payload) {
      log.auth.error('JWT auth failed: Invalid or expired token', { path });
      return unauthorized(c, 'Invalid or expired token');
    }

    log.auth.info('JWT auth success', { path, username: payload.username });
    await next();
  };
}

function unauthorized(c: any, message: string) {
  return c.json(
    {
      error: 'Unauthorized',
      message,
    },
    401
  );
}
