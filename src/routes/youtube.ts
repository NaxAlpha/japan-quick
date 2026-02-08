/**
 * YouTube OAuth API Routes
 * Handles authentication flow for YouTube integration
 */

import { Hono } from 'hono';
import type { Env } from '../types/env.js';
import { YouTubeAuthService } from '../services/youtube-auth.js';
import { generateRequestId, createLogger } from '../lib/logger.js';
import { successResponse, errorResponse, serverErrorResponse } from '../lib/api-response.js';

const log = createLogger('YouTubeRoutes');

const youtubeRoutes = new Hono<{ Bindings: Env['Bindings'] }>();

/**
 * GET /api/youtube/status
 * Get current YouTube authentication status
 */
youtubeRoutes.get('/status', async (c) => {
  const reqId = generateRequestId();
  const startTime = Date.now();

  log.info(reqId, 'Status request received');

  try {
    const service = new YouTubeAuthService(
      c.env.DB,
      c.env.NEWS_CACHE,
      c.env.YOUTUBE_CLIENT_ID,
      c.env.YOUTUBE_CLIENT_SECRET,
      c.env.YOUTUBE_REDIRECT_URI
    );

    const status = await service.getAuthStatus(reqId);

    const durationMs = Date.now() - startTime;
    log.info(reqId, 'Status request completed', { durationMs, isConnected: status.isConnected });

    return successResponse({ data: status });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error(reqId, 'Status request failed', error as Error);
    return serverErrorResponse(error as Error);
  }
});

/**
 * GET /api/youtube/auth/url
 * Generate OAuth authorization URL
 */
youtubeRoutes.get('/auth/url', async (c) => {
  const reqId = generateRequestId();
  const startTime = Date.now();

  log.info(reqId, 'Auth URL request received');

  try {
    const service = new YouTubeAuthService(
      c.env.DB,
      c.env.NEWS_CACHE,
      c.env.YOUTUBE_CLIENT_ID,
      c.env.YOUTUBE_CLIENT_SECRET,
      c.env.YOUTUBE_REDIRECT_URI
    );

    const { url, state } = await service.generateAuthUrl(reqId);

    const durationMs = Date.now() - startTime;
    log.info(reqId, 'Auth URL generated', { durationMs, state });

    return successResponse({ data: { url, state } });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error(reqId, 'Auth URL generation failed', error as Error);
    return serverErrorResponse(error as Error);
  }
});

/**
 * GET /api/youtube/oauth/callback
 * Handle OAuth callback from Google
 */
youtubeRoutes.get('/oauth/callback', async (c) => {
  const reqId = generateRequestId();
  const startTime = Date.now();

  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  log.info(reqId, 'OAuth callback received', { hasCode: !!code, hasState: !!state, error });

  // Handle OAuth error from Google
  if (error) {
    log.warn(reqId, 'OAuth error from Google', { error });
    return c.redirect('/settings?error=oauth_error');
  }

  // Validate parameters
  if (!code) {
    log.warn(reqId, 'No code in callback');
    return c.redirect('/settings?error=no_code');
  }

  if (!state) {
    log.warn(reqId, 'No state in callback');
    return c.redirect('/settings?error=no_state');
  }

  try {
    const service = new YouTubeAuthService(
      c.env.DB,
      c.env.NEWS_CACHE,
      c.env.YOUTUBE_CLIENT_ID,
      c.env.YOUTUBE_CLIENT_SECRET,
      c.env.YOUTUBE_REDIRECT_URI
    );

    // Verify state for CSRF protection
    const stateValid = await service.verifyState(reqId, state);
    if (!stateValid) {
      log.warn(reqId, 'Invalid OAuth state', { state });
      return c.redirect('/settings?error=invalid_state');
    }

    // Exchange code for tokens
    const tokens = await service.exchangeCodeForTokens(reqId, code);

    // Fetch channel info
    const channelInfo = await service.fetchChannelInfo(reqId, tokens.access_token);

    // Save auth record
    await service.saveAuthRecord(reqId, channelInfo.id, channelInfo.title, tokens);

    const durationMs = Date.now() - startTime;
    log.info(reqId, 'OAuth flow completed', { durationMs, channelId: channelInfo.id });

    return c.redirect('/settings?success=connected');
  } catch (err) {
    const durationMs = Date.now() - startTime;
    log.error(reqId, 'OAuth flow failed', err as Error);
    return c.redirect('/settings?error=auth_failed');
  }
});

/**
 * POST /api/youtube/refresh
 * Manually refresh access token
 */
youtubeRoutes.post('/refresh', async (c) => {
  const reqId = generateRequestId();
  const startTime = Date.now();

  log.info(reqId, 'Token refresh request received');

  try {
    const service = new YouTubeAuthService(
      c.env.DB,
      c.env.NEWS_CACHE,
      c.env.YOUTUBE_CLIENT_ID,
      c.env.YOUTUBE_CLIENT_SECRET,
      c.env.YOUTUBE_REDIRECT_URI
    );

    const result = await service.refreshAccessToken(reqId);

    const durationMs = Date.now() - startTime;
    log.info(reqId, 'Token refreshed', { durationMs, expiresAt: result.expiresAt });

    return successResponse({ data: result });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error(reqId, 'Token refresh failed', error as Error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to refresh token';
    const status = errorMessage === 'not_authenticated' ? 401 : 500;

    return errorResponse(errorMessage, status);
  }
});

/**
 * DELETE /api/youtube/auth
 * Deauthorize and clear tokens
 */
youtubeRoutes.delete('/auth', async (c) => {
  const reqId = generateRequestId();
  const startTime = Date.now();

  log.info(reqId, 'Deauthorize request received');

  try {
    const service = new YouTubeAuthService(
      c.env.DB,
      c.env.NEWS_CACHE,
      c.env.YOUTUBE_CLIENT_ID,
      c.env.YOUTUBE_CLIENT_SECRET,
      c.env.YOUTUBE_REDIRECT_URI
    );

    await service.deleteAuthRecord(reqId);

    const durationMs = Date.now() - startTime;
    log.info(reqId, 'Deauthorize completed', { durationMs });

    return successResponse({ data: { message: 'Disconnected successfully' } });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error(reqId, 'Deauthorize failed', error as Error);
    return serverErrorResponse(error as Error);
  }
});

export default youtubeRoutes;
