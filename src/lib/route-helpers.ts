import type { Logger, LogContext } from './logger.js';
import { serverErrorResponse } from './api-response.js';

interface RouteRequestMeta extends LogContext {
  method: string;
  path: string;
}

/**
 * Wraps a route with consistent request lifecycle logging and error handling.
 */
export async function runRoute(
  logger: Logger,
  reqId: string,
  request: RouteRequestMeta,
  handler: () => Promise<Response>
): Promise<Response> {
  const startTime = Date.now();
  let response: Response | undefined;

  logger.info(reqId, 'Request received', request);

  try {
    response = await handler();
    return response;
  } catch (error) {
    logger.error(reqId, 'Request failed', error as Error);
    response = serverErrorResponse(error as Error);
    return response;
  } finally {
    logger.info(reqId, 'Request completed', {
      status: response?.status ?? 500,
      durationMs: Date.now() - startTime,
    });
  }
}
