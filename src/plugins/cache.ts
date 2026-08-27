/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FetcherMiddleware } from "../fetcher";
import type { HttpResponse } from "../response";

/**
 * Options for configuring the cache plugin.
 */
export interface CachePluginOptions {
  /** Time-to-live for cached responses in milliseconds (default: 60000ms) */
  ttl?: number;
}

/**
 * Middleware plugin that provides lightweight in-memory caching.
 * Responses are cached based on the action key and arguments.
 */
export function cachePlugin(options: CachePluginOptions = {}): FetcherMiddleware {
  const ttl = options.ttl ?? 60000; // Mặc định 60s
  const cache = new Map<string, { data: HttpResponse<any, any>; expiresAt: number }>();

  return async (action, args, next) => {
    const hashKey = `${action.key}_${JSON.stringify(args)}`;
    const cachedItem = cache.get(hashKey);

    // Trả về cache nếu vẫn còn hạn
    if (cachedItem && cachedItem.expiresAt > Date.now()) {
      return cachedItem.data;
    }

    // Gọi hàm tiếp theo
    const res = await next();

    // Lưu vào cache
    cache.set(hashKey, {
      data: res,
      expiresAt: Date.now() + ttl,
    });

    return res;
  };
}
