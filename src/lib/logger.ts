/**
 * Logger utility for structured logging across the application.
 * All logs include request ID, timestamp, level, component, and optional context.
 */

/**
 * Generates a 6-character alphanumeric request ID.
 * Example: "a1b2c3"
 */
export function generateRequestId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Log level enumeration
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/**
 * Log context interface for key-value pairs
 */
export type LogValue = unknown;

export interface LogContext {
  [key: string]: LogValue;
}

/**
 * Formats log context into "key=value" pairs
 */
function formatValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatContext(context?: LogContext): string {
  if (!context || Object.keys(context).length === 0) {
    return '';
  }

  const pairs = Object.entries(context)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${formatValue(value)}`);

  return pairs.length > 0 ? ` | ${pairs.join(' ')}` : '';
}

/**
 * Formats a log entry with all required fields
 */
function formatLogEntry(
  reqId: string,
  timestamp: string,
  level: LogLevel,
  component: string,
  message: string,
  context?: LogContext
): string {
  const contextStr = formatContext(context);
  return `[${reqId}] [${timestamp}] [${level}] [${component}] ${message}${contextStr}`;
}

/**
 * Creates a logger for a specific component
 */
export interface Logger {
  debug(message: string, context?: LogContext): void;
  debug(reqId: string, message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  info(reqId: string, message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  warn(reqId: string, message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  error(message: string, error: Error, context?: LogContext): void;
  error(reqId: string, message: string, context?: LogContext): void;
  error(reqId: string, message: string, error: Error, context?: LogContext): void;
}

export function createLogger(component: string): Logger {
  // Helper to normalize arguments - handles both (message, context) and (reqId, message, context)
  function normalizeArgs(
    arg1: string,
    arg2: string | LogContext | undefined,
    arg3?: LogContext
  ): { reqId: string; message: string; context?: LogContext } {
    // If arg2 is a string, it's the message (reqId, message, context) signature
    if (typeof arg2 === 'string') {
      return { reqId: arg1, message: arg2, context: arg3 };
    }
    // Otherwise it's (message, context) signature - generate reqId
    return { reqId: generateRequestId(), message: arg1, context: arg2 as LogContext | undefined };
  }

  return {
    debug(arg1: string, arg2?: string | LogContext, arg3?: LogContext): void {
      const { reqId, message, context } = normalizeArgs(arg1, arg2, arg3);
      const timestamp = new Date().toISOString();
      const logEntry = formatLogEntry(reqId, timestamp, 'DEBUG', component, message, context);
      console.debug(logEntry);
    },

    info(arg1: string, arg2?: string | LogContext, arg3?: LogContext): void {
      const { reqId, message, context } = normalizeArgs(arg1, arg2, arg3);
      const timestamp = new Date().toISOString();
      const logEntry = formatLogEntry(reqId, timestamp, 'INFO', component, message, context);
      console.log(logEntry);
    },

    warn(arg1: string, arg2?: string | LogContext, arg3?: LogContext): void {
      const { reqId, message, context } = normalizeArgs(arg1, arg2, arg3);
      const timestamp = new Date().toISOString();
      const logEntry = formatLogEntry(reqId, timestamp, 'WARN', component, message, context);
      console.warn(logEntry);
    },

    error(
      arg1: string,
      arg2?: string | Error | LogContext,
      arg3?: Error | LogContext,
      arg4?: LogContext
    ): void {
      const timestamp = new Date().toISOString();
      let context: LogContext | undefined;
      let reqId: string;
      let message: string;
      let error: Error | undefined;

      // Handle different overload signatures for error
      if (typeof arg2 === 'string') {
        // (reqId, message, error, context) or (reqId, message, context)
        reqId = arg1;
        message = arg2;
        if (arg3 instanceof Error) {
          error = arg3;
          context = arg4;
        } else {
          context = arg3 as LogContext | undefined;
        }
      } else if (arg2 instanceof Error) {
        // (message, error, context) signature
        reqId = generateRequestId();
        message = arg1;
        error = arg2;
        context = arg3 as LogContext | undefined;
      } else {
        // (message, context) signature
        const normalized = normalizeArgs(arg1, arg2, arg3);
        reqId = normalized.reqId;
        message = normalized.message;
        context = normalized.context;
      }

      if (error) {
        context = {
          ...(context || {}),
          error: error.message,
          stack: error.stack,
        };
      }

      const logEntry = formatLogEntry(reqId, timestamp, 'ERROR', component, message, context);
      console.error(logEntry);
    }
  };
}

/**
 * Pre-configured loggers for various components
 */
export const log = {
  // AI Services
  gemini: createLogger('GeminiService'),
  scriptGeneration: createLogger('ScriptGeneration'),
  assetGen: createLogger('AssetGenerator'),

  // Scrapers
  articleScraper: createLogger('ArticleScraper'),
  articleScraperCore: createLogger('ArticleScraperCore'),
  newsScraper: createLogger('NewsScraper'),

  // Routes
  newsRoutes: createLogger('NewsRoutes'),
  articleRoutes: createLogger('ArticleRoutes'),
  videoRoutes: createLogger('VideoRoutes'),
  assetRoutes: createLogger('AssetRoutes'),
  youtubeRoutes: createLogger('YouTubeRoutes'),
  auth: createLogger('Auth'),
  app: createLogger('App'),

  // Services
  youtubeAuth: createLogger('YouTubeAuth'),
  youTubeUpload: createLogger('YouTubeUpload'),
  videoRenderer: createLogger('VideoRenderer'),
  imageFetcher: createLogger('ImageFetcher'),

  // Workflows
  newsScraperWorkflow: createLogger('NewsScraperWorkflow'),
  scheduledRefreshWorkflow: createLogger('ScheduledRefreshWorkflow'),
  articleScraperWorkflow: createLogger('ArticleScraperWorkflow'),
  articleRescrapeWorkflow: createLogger('ArticleRescrapeWorkflow'),
  videoSelectionWorkflow: createLogger('VideoSelectionWorkflow'),
  videoRenderWorkflow: createLogger('VideoRenderWorkflow'),
  scriptGenerationWorkflow: createLogger('ScriptGenerationWorkflow'),
  assetGenerationWorkflow: createLogger('AssetGenerationWorkflow'),
  youTubeUploadWorkflow: createLogger('YouTubeUploadWorkflow'),
  testChunked: createLogger('TestChunked'),
};

export default log;
