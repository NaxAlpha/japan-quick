/**
 * JWT Authentication Service
 * Handles token generation and verification using Hono's JWT middleware
 */

import { sign, verify } from 'hono/jwt';
import type { JWTPayload } from 'hono/jwt';
import type { Env } from '../types/env.js';
import { log, generateRequestId } from '../lib/logger.js';

const TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthToken {
  token: string;
  expiresIn: number;
}

export interface TokenPayload extends JWTPayload {
  username: string;
  iat: number;
  exp: number;
}

/**
 * Validates login credentials against environment variables
 */
export async function validateCredentials(
  credentials: LoginCredentials,
  env: Env['Bindings']
): Promise<boolean> {
  const validUsername = env.ADMIN_USERNAME;
  const validPassword = env.ADMIN_PASSWORD;

  return (
    credentials.username === validUsername &&
    credentials.password === validPassword
  );
}

/**
 * Generates a JWT token for authenticated users
 */
export async function generateToken(
  username: string,
  env: Env['Bindings']
): Promise<AuthToken> {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    username,
    iat: now,
    exp: now + TOKEN_EXPIRY_SECONDS,
  };

  const token = await sign(payload, env.JWT_SECRET);

  return {
    token,
    expiresIn: TOKEN_EXPIRY_SECONDS,
  };
}

/**
 * Verifies a JWT token and returns the payload
 */
export async function verifyToken(
  token: string,
  env: Env['Bindings']
): Promise<TokenPayload | null> {
  const reqId = generateRequestId();

  try {
    // Verify JWT_SECRET exists
    if (!env.JWT_SECRET) {
      log.auth.error(reqId, 'JWT_SECRET is not configured');
      return null;
    }

    // Hono/jwt requires alg to be specified for verification
    const payload = await verify(token, env.JWT_SECRET, 'HS256');
    log.auth.info(reqId, 'Token verification success', { username: (payload as any).username });
    return payload as TokenPayload;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.auth.error(reqId, 'Token verification failed', error as Error, { error: message });
    return null;
  }
}
