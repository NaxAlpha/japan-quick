/**
 * Authentication utilities for frontend API requests.
 * Provides centralized JWT auth header generation.
 * Re-exports from auth-service for backward compatibility.
 */

export {
  getAuthHeaders,
  login,
  logout,
  isAuthenticated,
  validateToken,
  handleUnauthorized,
  authenticatedFetch,
  type LoginCredentials,
  type LoginResponse
} from './auth-service.js';
