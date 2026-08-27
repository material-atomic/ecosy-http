/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FetcherMiddleware } from "../fetcher";

/**
 * Interface defining the logging methods required by the loggerPlugin.
 */
export interface LoggerPluginOptions {
  /** The logger instance to use (e.g. console, winston, @ecosy/logger). Fallbacks to native console if available. */
  logger?: any;
  /** The method name to call on the logger for successful requests. Defaults to "info" or "log". */
  successLevel?: string;
  /** The method name to call on the logger for failed requests. Defaults to "error". */
  errorLevel?: string;
  
  /** Custom formatter for the request start log. Returns an array of arguments to be spread into the logger. */
  formatStart?: (key: string, args: any[]) => any[];
  /** Custom formatter for a successful response log. */
  formatSuccess?: (key: string, res: any, durationMs: number) => any[];
  /** Custom formatter for a failed response log. */
  formatError?: (key: string, err: any, durationMs: number) => any[];
}

/**
 * Middleware plugin that logs the lifecycle and execution time of requests.
 * Uses Dependency Inversion Principle (DIP) to allow passing any custom logger.
 * Supports custom log levels mapping and custom formatting.
 */
export function loggerPlugin(options: LoggerPluginOptions | any = {}): FetcherMiddleware {
  // Support legacy direct logger instance passing (if options is the logger itself)
  const isOptionsObject = options && !options.info && !options.log && Object.getPrototypeOf(options) === Object.prototype;
  const config: LoggerPluginOptions = isOptionsObject ? options : { logger: options };

  const fallbackLogger = typeof console !== "undefined" ? console : undefined;
  const targetLogger = config.logger || fallbackLogger;

  const successMethod = config.successLevel || "info";
  const errorMethod = config.errorLevel || "error";

  const logInfo = targetLogger?.[successMethod]?.bind(targetLogger) || targetLogger?.log?.bind(targetLogger) || (() => {});
  const logError = targetLogger?.[errorMethod]?.bind(targetLogger) || (() => {});

  const defaultFormatStart = (key: string, args: any[]) => [`[Fetcher] 🚀 Start: ${key}`, args];
  const defaultFormatSuccess = (key: string, res: any, time: number) => [`[Fetcher] ✅ Success: ${key} (${time}ms)`, res];
  const defaultFormatError = (key: string, err: any, time: number) => [`[Fetcher] ❌ Error: ${key} (${time}ms)`, err];

  const formatStart = config.formatStart || defaultFormatStart;
  const formatSuccess = config.formatSuccess || defaultFormatSuccess;
  const formatError = config.formatError || defaultFormatError;

  return async (action, args, next) => {
    const start = Date.now();
    logInfo(...formatStart(action.key, args));
    try {
      const res = await next();
      logInfo(...formatSuccess(action.key, res, Date.now() - start));
      return res;
    } catch (err) {
      logError(...formatError(action.key, err, Date.now() - start));
      throw err;
    }
  };
}
