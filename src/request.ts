import type { HttpMethod } from "./method";

/** Accepted query parameter formats for HTTP requests. */
export type HttpQuery =
  | string
  | Record<string, string | number | boolean | undefined>
  | Array<[string, string | number | boolean | undefined]>
  | URLSearchParams;

/** Configuration object for an HTTP request. */
export interface HttpRequest<
  Body = unknown,
  Params = Record<string, unknown>,
  Query = HttpQuery,
  Headers = Record<string, string>,
> {
  method: HttpMethod;
  url: string;
  headers?: Headers;
  body?: Body;
  query?: Query;
  params?: Params;
  signal?: AbortSignal;
  /**
   * Pass-through bag for `fetch`'s `RequestInit` options that the
   * library does not manage itself (`credentials`, `cache`, `mode`,
   * `redirect`, `referrer`, `referrerPolicy`, `integrity`, `keepalive`,
   * `priority`, `duplex`) plus framework extensions (`next` on Next.js,
   * `cf` on Cloudflare Workers, `dispatcher` on undici).
   *
   * Lib-level fields (`method`, `headers`, `body`, `signal`) cannot be
   * overridden here — they are applied after this bag is spread.
   * Unknown keys are silently dropped, so a compromised caller cannot
   * smuggle arbitrary fields into `fetch`.
   */
  configs?: Record<string, unknown>;
}
