/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FetcherMiddleware } from "../fetcher";
import type { HttpResponse } from "../response";

/**
 * Middleware plugin that prevents the "Thundering Herd" problem.
 * It deduplicates identical concurrent requests and shares the same Promise 
 * among all callers, ensuring only one network request is made.
 */
export function dedupePlugin(): FetcherMiddleware {
  const pendingRequests = new Map<string, Promise<HttpResponse<any, any>>>();

  return async (action, args, next) => {
    // Tạo khóa duy nhất dựa trên endpoint key và tham số truyền vào
    const hashKey = `${action.key}_${JSON.stringify(args)}`;

    // Nếu đã có request đang bay, trả về luôn Promise đó để chờ chung
    if (pendingRequests.has(hashKey)) {
      return pendingRequests.get(hashKey)!;
    }

    // Nếu chưa có, tiến hành gọi API và lưu Promise lại
    const promise = next().finally(() => {
      pendingRequests.delete(hashKey); // Xóa khỏi bộ chờ khi xong
    });
    
    pendingRequests.set(hashKey, promise);
    return promise;
  };
}
