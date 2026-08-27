import { Serialize } from "./utils/serialize";
import { get } from "./utils/get";
import { Methods } from "./method";
import type { HttpInit, HttpInitSlice } from "./init";
import type { HttpQuery } from "./request";
import { isFormData } from "./utils/formdata";

/** Reserved keys that must never be honored in user-supplied query / param objects. */
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Keys allowed on {@link HttpRequest.fetch}. Lib-level fields
 * (`method`, `headers`, `body`, `signal`) are handled separately and
 * must not appear here — they would let a caller override what the
 * library has already decided.
 *
 * Framework-specific extensions (`next` for Next.js App Router,
 * `cf` for Cloudflare Workers, `dispatcher` for undici) are allowed
 * so apps can pass them through without the lib depending on any of
 * those runtimes.
 */
const ALLOWED_FETCH_KEYS: ReadonlySet<string> = new Set([
  "credentials",
  "cache",
  "mode",
  "redirect",
  "referrer",
  "referrerPolicy",
  "integrity",
  "keepalive",
  "priority",
  "duplex",
  "window",
  "next",
  "cf",
  "dispatcher",
]);

export class HttpUtils {
  static readonly AllowedOrigins = new Set();

  static defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };

  static isAllowedOrigin(origin: string): boolean {
    return this.AllowedOrigins.size === 0 || this.AllowedOrigins.has(origin);
  }

  static isValidQuery(query: unknown): query is HttpQuery {
    if (typeof query === "string" || query instanceof URLSearchParams) {
      return true;
    }

    if (Array.isArray(query)) {
      return query.every(
        (item) =>
          Array.isArray(item) &&
          item.length === 2 &&
          typeof item[0] === "string" &&
          Serialize.Primitive.isPrimitive(item[1]),
      );
    }

    if (typeof query === "object" && query !== null) {
      return Object.values(query).every((value) => Serialize.Primitive.isPrimitive(value));
    }

    return false;
  }

  /** Strip prototype-pollution vectors from a plain object shallowly. */
  static stripUnsafeKeys<T extends Record<string, unknown>>(source: T): T {
    const out: Record<string, unknown> = Object.create(null);
    for (const key of Object.keys(source)) {
      if (UNSAFE_KEYS.has(key)) continue;
      out[key] = source[key];
    }
    return out as T;
  }

  static normalizeQuery(options: HttpInit) {
    const { method, body, query } = options;
      
    const source = method === Methods.GET && HttpUtils.isValidQuery(body) ? body : query;

    if (!source || typeof source !== "object") {
      return typeof source === "string" ? source : "";
    }

    if (source instanceof URLSearchParams) {
      return source.toString();
    }

    const safe = HttpUtils.stripUnsafeKeys(source as Record<string, unknown>);

    return Serialize.queryString.stringify(safe, {
      skipNull: true,
      skipEmptyString: true,
    });
  }

  static normalizeURL(options: HttpInitSlice) {
    const { url = "", params = {} } = options;
    const queryString = HttpUtils.normalizeQuery(options);
    
    let finalURL: string;
    
    if (!url) {
      finalURL = options.url || "/";
    } else if (url.startsWith("//")) {
      throw new Error(`Http: protocol-relative URLs are not allowed: ${url}`);
    } else if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
      // Has a scheme — must be http/https and origin-allowed
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new Error(`Http: invalid absolute URL: ${url}`);
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error(`Http: unsupported URL scheme: ${parsed.protocol}`);
      }
      if (!HttpUtils.isAllowedOrigin(parsed.origin)) {
        throw new Error(
          `Http: URL origin '${parsed.origin}' is not in allowedOrigins`,
        );
      }
      finalURL = parsed.toString();
    } else {
      finalURL = url.startsWith("/") ? url : `/${url}`;
    }
    
    if (queryString) {
      const separator = finalURL.includes("?") ? "&" : "?";
      finalURL += `${separator}${queryString}`;
    }
    
    if (!finalURL.includes("{") || !finalURL.includes("}")) return finalURL;
    
    const safeParams = Array.isArray(params)
      ? params
      : HttpUtils.stripUnsafeKeys(params as Record<string, unknown>);
    
    return finalURL.replace(/\{([a-zA-Z0-9_.-]+)\}/g, (_m, variable) => {
      const value = get(safeParams, variable);
      if (value === null || value === undefined) return "";
      if (typeof value === "object") return "";
      return Serialize.URL.encode(String(value));
    });
  }

  static normalizeHeaders(headers: Record<string, string> = {}, isFormData?: boolean) {
    if (isFormData && "Content-Type" in headers) {
      delete headers["Content-Type"];
    } else {
      headers["Content-Type"] =
        headers["Content-Type"] || "application/json";
    }

    return {
      ...this.defaultHeaders,
      ...headers,
    };
  }

  static removeURL(options: Omit<HttpInitSlice, "url">) {
    return Object.entries(options).reduce((acc, [key, value]) => {
      if (key !== "url") {
        acc[key] = value as unknown as HttpInitSlice[keyof HttpInitSlice];
      }
      return acc;
    }, {} as Record<string, unknown>) as HttpInitSlice;
  }

  static extractFetchOptions(options: Omit<HttpInitSlice, "url">) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(options)) {
      if (ALLOWED_FETCH_KEYS.has(key)) {
        out[key] = (options as Record<string, unknown>)[key];
      }
    }
    return out as RequestInit;
  }

  static normalizeBody(options: Omit<HttpInitSlice, "url">): string | FormData | Uint8Array | ArrayBuffer | URLSearchParams | undefined {
    const { method, body } = options;

    if (
      method === Methods.GET ||
      method === Methods.HEAD ||
      method === Methods.OPTIONS
    ) {
      return undefined;
    }

    if (
      (method === Methods.POST || method === Methods.PUT || method === Methods.PATCH || method === Methods.DELETE) &&
      isFormData(body)
    ) {
      return body;
    }

    if (body instanceof URLSearchParams) {
      return body;
    }

    // Allow raw binary payloads (e.g. multipart/related body)
    if (body instanceof Uint8Array || body instanceof ArrayBuffer) {
      return body;
    }

    return body !== undefined ? JSON.stringify(body) : undefined;
  }

  /** Parse a URL string into its origin, returning `null` if the input is relative or invalid. */
  static safeOrigin(url: string): string | null {
    try {
      return new URL(url).origin;
    } catch {
      return null;
    }
  }

  static assertSameOriginResponse(
    requestURL: string,
    response: Response,
    sentHeaders: Record<string, string>,
  ): void {
    const hasAuthHeader = Object.keys(sentHeaders).some(
      (k) => k.toLowerCase() === "authorization" && !!sentHeaders[k],
    );
    const hasCookieHeader = Object.keys(sentHeaders).some(
      (k) => k.toLowerCase() === "cookie" && !!sentHeaders[k],
    );
    if (!hasAuthHeader && !hasCookieHeader) return;

    const reqOrigin = HttpUtils.safeOrigin(requestURL);
    if (!reqOrigin) return; // relative URL — same-origin by definition

    const resOrigin = response.url ? HttpUtils.safeOrigin(response.url) : null;
    if (!resOrigin || resOrigin === reqOrigin) return;

    if (this.isAllowedOrigin(resOrigin)) return;

    throw new Error(
      `Http: credentialed request was redirected from ${reqOrigin} to untrusted origin ${resOrigin}`,
    );
  }
}

