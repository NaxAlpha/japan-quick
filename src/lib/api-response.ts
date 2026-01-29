/**
 * API Response Helpers
 * Standardized response builders for consistent API responses across all routes
 */

/**
 * Success response with data
 * @param data - Response data (will be spread into response object)
 * @returns Response object with success: true
 */
export function successResponse<T extends Record<string, unknown>>(data: T): Response {
  return Response.json({
    success: true,
    ...data
  });
}

/**
 * Error response with message and HTTP status
 * @param message - Error message
 * @param status - HTTP status code (default: 400)
 * @returns Response object with success: false
 */
export function errorResponse(message: string, status = 400): Response {
  return Response.json({
    success: false,
    error: message
  }, { status });
}

/**
 * Not found error response
 * @param resource - Resource name that was not found (default: 'Resource')
 * @returns 404 Response object
 */
export function notFoundResponse(resource = 'Resource'): Response {
  return errorResponse(`${resource} not found`, 404);
}

/**
 * Server error response
 * @param error - Error object or message
 * @returns 500 Response object
 */
export function serverErrorResponse(error: Error | string): Response {
  const message = typeof error === 'string' ? error : error.message;
  return errorResponse(message || 'Internal server error', 500);
}

/**
 * Validation error response
 * @param message - Validation error message
 * @returns 400 Response object
 */
export function validationErrorResponse(message: string): Response {
  return errorResponse(message, 400);
}

/**
 * Conflict error response (e.g., resource already exists)
 * @param message - Conflict error message
 * @returns 409 Response object
 */
export function conflictResponse(message: string): Response {
  return errorResponse(message, 409);
}

/**
 * Unauthorized error response
 * @param message - Unauthorized error message (default: 'Unauthorized')
 * @returns 401 Response object
 */
export function unauthorizedResponse(message = 'Unauthorized'): Response {
  return errorResponse(message, 401);
}

/**
 * Helper to wrap async route handlers with error handling
 * Converts thrown errors into standardized error responses
 * @param handler - Async route handler function
 * @returns Wrapped handler with error handling
 */
export function withErrorHandling<
  T extends { req: { param?: (key: string) => string; query?: (key: string) => string } },
  R extends Response
>(
  handler: (c: T) => Promise<R>
): (c: T) => Promise<R> {
  return async (c: T): Promise<R> => {
    try {
      return await handler(c);
    } catch (error) {
      return serverErrorResponse(error as Error) as R;
    }
  };
}
