/**
 * Frontend Authentication Service
 * Handles JWT token storage, login/logout, and API auth headers
 */

const TOKEN_KEY = 'japan_quick_auth_token';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  data: {
    token: string;
    expiresIn: number;
  };
}

export interface MeResponse {
  success: boolean;
  data: {
    username: string;
    expiresIn: number;
  };
}

export interface ApiError {
  error: string;
  message: string;
}

/**
 * Checks if user is authenticated (has valid token in localStorage)
 */
export function isAuthenticated(): boolean {
  const token = localStorage.getItem(TOKEN_KEY);
  return !!token;
}

/**
 * Returns JWT auth headers for API requests
 * Used by all frontend components to authenticate API calls
 */
export function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    // If no token, return empty headers (will result in 401 from API)
    return {};
  }
  return {
    'Authorization': `Bearer ${token}`
  };
}

/**
 * Login with username/password
 * Stores JWT token in localStorage on success
 */
export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(credentials)
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.message || 'Login failed');
  }

  const data: LoginResponse = await response.json();

  // Store token in localStorage
  if (data.success && data.data.token) {
    localStorage.setItem(TOKEN_KEY, data.data.token);
  }

  return data;
}

/**
 * Logout - removes token from localStorage
 * Also calls server logout endpoint for logging purposes
 */
export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: getAuthHeaders()
    });
  } catch (error) {
    // Ignore logout API errors, just clear local token
    console.warn('Logout API call failed:', error);
  } finally {
    // Always clear the token
    localStorage.removeItem(TOKEN_KEY);
  }
}

/**
 * Validates current token with server
 * Returns user info if token is valid, null otherwise
 */
export async function validateToken(): Promise<{ username: string; expiresIn: number } | null> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    return null;
  }

  try {
    const response = await fetch('/api/auth/me', {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      // Token is invalid or expired, clear it
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }

    const data: MeResponse = await response.json();
    return data.data;
  } catch (error) {
    // Error validating token, clear it
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
}

/**
 * Helper to handle 401 responses
 * Automatically logs out user and redirects to login
 */
export function handleUnauthorized(): void {
  logout();
  window.location.href = '/login';
}

/**
 * Authenticated fetch wrapper
 * Automatically handles 401 responses by redirecting to login
 * Preserves the current page URL in the return URL query param
 *
 * @example
 * ```typescript
 * const response = await authenticatedFetch('/api/videos');
 * const data = await response.json();
 * ```
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  // Automatically handle 401 responses
  if (response.status === 401) {
    // Store the current page URL for redirect after login
    const currentPath = window.location.pathname + window.location.search;
    const returnParam = currentPath !== '/' && currentPath !== '/login'
      ? `?return=${encodeURIComponent(currentPath)}`
      : '';

    // Clear token and redirect to login
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = `/login${returnParam}`;

    // Return a rejected promise to prevent further processing
    return Promise.reject(new Error('Unauthorized - redirecting to login'));
  }

  return response;
}
