/* eslint-disable @typescript-eslint/no-explicit-any */
import { flatten } from "./utils/flatten";
import { Http } from "./http";
import type { HttpInit } from "./init";
import type { HttpResponse } from "./response";
import type { HttpUploadOptions, HttpRelatedOptions } from "./xml";
import { Methods, type HttpMethod } from "./method";
import type { FileListLike } from "./utils/filelist";

/**
 * Configuration options for initializing a base HTTP client.
 */
export interface HttpClientOptions {
  /** The base URL for all requests (e.g. "https://api.example.com") */
  baseURL?: string;
  /** An existing Http instance to reuse, if any. */
  http?: Http;
  /** A dictionary of endpoints, or a function returning one. Used to map action keys to URLs. */
  endpoint?: Record<string, unknown> | (() => Record<string, unknown>);
}

/**
 * Represents an unexecuted HTTP action (descriptor).
 * Contains the mapped endpoint key and a lazy function to execute the request.
 */
export interface HttpAction<T = unknown, Args extends any[] = [], E = unknown> {
  key: string;
  fn: (...args: Args) => Promise<HttpResponse<T, E>>;
}

/**
 * Creates a client that generates typed endpoint actions.
 * Each action has a `key` (useful for caching keys like React Query) and an async `fn`.
 *
 * @example
 * ```ts
 * const api = createClient({
 *   baseURL: "https://api.example.com",
 *   endpoint: { users: { list: "/users", create: "/users" } },
 * });
 *
 * const getUsers = api<User[]>("users.list");
 * const { data } = await getUsers.fn();
 * ```
 */
export function createClient(options: HttpClientOptions = {}) {
  const instance = options.http || new Http(options.baseURL);

  const getEndpoints = () => {
    if (typeof options.endpoint === "function") {
      return options.endpoint();
    } else if (options.endpoint) {
      return options.endpoint;
    } else {
      return Http.Endpoint.all();
    }
  };

  return function client<T, Args extends any[] = [], E = unknown>(
    key: string,
    method?: HttpMethod | "upload" | "related",
  ): HttpAction<T, Args, E> {
    const urls = flatten(getEndpoints()) as Record<string, string>;
    const url = urls[key] as string;

    return {
      key,
      fn: async (...args: Args) => {
        /* One options object per call, whatever the method.
         *
         * `post(url, body, init)` takes the body first, so passing the usual
         * `{ params, body }` straight through made the whole object the body
         * and left `params` unread — every `{id}` in a mutation URL resolved
         * to an empty string. Split it here, so a call site never has to know
         * which argument slot a given method happens to use. */
        const [options] = args as unknown as [Record<string, unknown> | undefined];
        const { body, ...init } = (options ?? {}) as { body?: unknown };

        switch (method) {
          case Methods.POST:
            return await instance.post<T, E>(url, body, init as any);
          case Methods.PUT:
            return await instance.put<T, E>(url, body, init as any);
          case Methods.PATCH:
            return await instance.patch<T, E>(url, body, init as any);
          case Methods.DELETE:
            return await instance.delete<T, E>(url, body, init as any);
          case Methods.HEAD:
            return await instance.head<T, E>(url, ...(args as unknown as [any]));
          case Methods.OPTIONS:
            return await instance.options<T, E>(url, ...(args as unknown as [any]));
          case "upload":
            return await instance.upload<T, E>(
              url,
              ...(args as unknown as [File | File[] | FileListLike, (HttpUploadOptions & Omit<HttpInit, "url" | "method" | "body">)?])
            );
          case "related":
            return await instance.related<T, E>(
              url,
              ...(args as unknown as [ArrayBuffer | Uint8Array, HttpRelatedOptions & Omit<HttpInit, "url" | "method" | "body">])
            );
          default:
            return await instance.get<T, E>(url, ...(args as unknown as [any]));
        }
      },
    };
  };
}
