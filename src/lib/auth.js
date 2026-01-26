/**
 * Authentication utilities for frontend API requests.
 * Provides centralized Basic Auth header generation.
 */
/**
 * Returns Basic Auth headers for API requests.
 * Credentials match those in wrangler.toml [vars] section.
 */
export function getAuthHeaders() {
    const username = 'admin';
    const password = 'GvkP525fTX0ocMTw8XtAqM9ECvNIx50v';
    const credentials = btoa(`${username}:${password}`);
    return {
        'Authorization': `Basic ${credentials}`
    };
}
//# sourceMappingURL=auth.js.map