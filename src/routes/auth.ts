/**
 * Authentication Routes
 * Provides login, token validation, and logout endpoints
 */

import { Hono } from 'hono';
import type { Env } from '../types/env.js';
import { validateCredentials, generateToken, verifyToken } from '../services/jwt-auth.js';
import { log, generateRequestId } from '../lib/logger.js';

const authRoutes = new Hono<{ Bindings: Env['Bindings'] }>();

authRoutes.post('/login', async (c) => {
  const reqId = generateRequestId();
  log.auth.info(reqId, 'Login attempt');

  try {
    const body = await c.req.json();
    const { username, password } = body;

    if (!username || !password) {
      log.auth.warn(reqId, 'Login failed: Missing credentials');
      return c.json(
        {
          error: 'Bad Request',
          message: 'Username and password are required',
        },
        400
      );
    }

    const isValid = await validateCredentials({ username, password }, c.env);

    if (!isValid) {
      log.auth.warn(reqId, 'Login failed: Invalid credentials', { username });
      return c.json(
        {
          error: 'Unauthorized',
          message: 'Invalid username or password',
        },
        401
      );
    }

    const authToken = await generateToken(username, c.env);
    log.auth.info(reqId, 'Login success', { username });

    return c.json({
      success: true,
      data: authToken,
    });
  } catch (error) {
    // Handle JSON parse errors specifically
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      log.auth.warn(reqId, 'Login failed: Invalid JSON');
      return c.json(
        {
          error: 'Bad Request',
          message: 'Invalid JSON in request body',
        },
        400
      );
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    log.auth.error(reqId, 'Login error', error as Error, { error: message });
    return c.json(
      {
        error: 'Internal Server Error',
        message: 'An error occurred during login',
      },
      500
    );
  }
});

authRoutes.get('/me', async (c) => {
  const reqId = generateRequestId();
  const authHeader = c.req.header('Authorization');

  log.auth.info(reqId, 'Token validation attempt');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    log.auth.warn(reqId, 'Token validation failed: Missing token');
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Missing authentication token',
      },
      401
    );
  }

  const token = authHeader.substring(7);
  const payload = await verifyToken(token, c.env);

  if (!payload) {
    log.auth.warn(reqId, 'Token validation failed: Invalid token');
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      },
      401
    );
  }

  log.auth.info(reqId, 'Token validation success', { username: payload.username });

  return c.json({
    success: true,
    data: {
      username: payload.username,
      expiresIn: payload.exp - Math.floor(Date.now() / 1000),
    },
  });
});

authRoutes.post('/logout', async (c) => {
  const reqId = generateRequestId();
  log.auth.info(reqId, 'Logout request');

  // JWT is stateless, so logout is handled client-side by removing the token
  return c.json({
    success: true,
    message: 'Logged out successfully',
  });
});

export { authRoutes };
