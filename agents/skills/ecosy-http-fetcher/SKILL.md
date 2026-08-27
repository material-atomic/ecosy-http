---
name: ecosy-http-fetcher
description: Guides the AI on using the Fetcher Builder (Mutable Chaining) from @ecosy/core instead of using axios/fetch directly, along with plugin integration (logger, dedupe, cache).
---

# `ecosy-http-fetcher` Skill

When asked to implement API calls (HTTP Requests) in a project that has `@ecosy/core` installed, you must **NEVER** use `fetch`, `axios`, or `ky` directly. Instead, you must always use the **Fetcher Builder** architecture provided by `@ecosy/core`.

## 1. Initialization Principle (Builder)

The `Fetcher` is a **Mutable Chaining Builder**. It acts as a configuration builder, a callable factory, and an executor simultaneously.

```typescript
import { Fetcher } from "@ecosy/http";

// Initialize the root Fetcher for the application
export const api = Fetcher({
  baseURL: "https://api.example.com/v1"
});
```

## 2. Attaching Plugins (Middleware)

`@ecosy/core` utilizes a Middleware architecture (Koa-style). There are 3 built-in plugins that you should use when appropriate:
- `loggerPlugin()`: Automatically logs execution time and payload.
- `dedupePlugin()`: Prevents request duplication (mitigates the Thundering Herd problem).
- `cachePlugin({ ttl })`: Provides an in-memory cache with expiration.

```typescript
import { Fetcher, loggerPlugin, dedupePlugin, cachePlugin } from "@ecosy/http";

export const api = Fetcher({ baseURL: "https://api.example.com" })
  .use(loggerPlugin())
  .use(dedupePlugin())
  .use(cachePlugin({ ttl: 60000 }));
```

## 3. Late-Binding Auth Configuration (Retry Hook)

Never embed Domain logic (like retrieving tokens from LocalStorage or calling a refresh token API) directly inside the Fetcher's core initialization code. Use the Late-Binding mechanism via `.request()` and `.retry()` hooks.

**CRITICAL**: The `.retry()` hook supports returning a Promise, so you must apply a Debouncing technique (e.g., using a shared `refreshing` flag/promise) to prevent multiple concurrent requests from triggering the refresh token logic simultaneously.

```typescript
import { api } from "./api-client";
import { authStore } from "./auth-store";

let refreshing: Promise<boolean> | null = null;

// Inject the Token before sending
api.request(async (options) => {
  const token = authStore.getState().accessToken;
  if (token) {
    options.headers = { ...options.headers, Authorization: `Bearer ${token}` };
  }
  return options;
});

// Automatically handle Token Refresh on 401 errors
api.retry(async (res, key) => {
  if (res.status === 401) {
    if (!refreshing) {
      refreshing = authStore.refreshToken().then(() => true).catch(() => false);
    }
    const success = await refreshing;
    refreshing = null;
    return success; // Return true to instruct the Fetcher to retry the failed request
  }
  return false;
});
```

## 4. Executing API Calls

There are two ways to use the Fetcher:
1. **Using `.execute()` or `.fetcher()`**: Ideal for direct execution.
2. **Callable mapping**: Pass a `key` into `api("users.get")` to generate an unexecuted `HttpAction` descriptor, which is highly useful for integrating with tools like React Query or SWR.

```typescript
// 1. Direct execution via execute
const action = api<User, [string]>("users.getUser", "GET");
const res = await api.execute(action, ["userId123"]);

// 2. Quick execution via fetcher (no array required for args)
const res2 = await api.fetcher(action, "userId123");

if (res.success) {
  console.log(res.data);
} else {
  console.error(res.error);
}
```
