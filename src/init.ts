/* eslint-disable @typescript-eslint/no-explicit-any */
import type { HttpMethod } from "./method";
import type { MaybeArray } from "./array";
import type { Promisable } from "./types";

export type HttpCredentials = "same-origin" | "include" | "omit";
export type HttpCache = "force-cache" | "no-store";
export type HttpMode = "cors" | "no-cors" | "same-origin";
export type HttpRedirect = "follow" | "manual" | "error";
export type HttpPriority = "auto" | "high" | "low";
export type HttpDuplex = "half" | "full";
export type HttpImageFit = "scale-down" | "contain" | "cover" | "crop";
export type HttpPolish = "lossless" | "lossy" | "off";
export type HttpReferrerPolicy =
  | "no-referrer"
  | "no-referrer-when-downgrade"
  | "same-origin"
  | "origin"
  | "strict-origin"
  | "origin-when-cross-origin"
  | "strict-origin-when-cross-origin"
  | "unsafe-url";

export interface HttpInitNext {
  revalidate?: number;
  tags?: string[];
}

export interface HttpInitCf {
  cacheEverything?: boolean;
  cacheTtl?: number;
  cacheKey?: string;
  cacheTtlByStatus?: Record<string, number>;
  cacheTags?: string[];
  resolveOverride?: boolean;
  image?: {
    width?: number;
    height?: number;
    fit?: HttpImageFit;
    format?: string;
    quality?: number;
  };
  apps?: boolean;
  scrapeShield?: boolean;
  polish?: HttpPolish;
  minify?: {
    javascript?: boolean;
    html?: boolean;
    css?: boolean;
  };
  colo?: string;
}

/** Interceptor that can modify a request before it is sent. */
export type HttpInterceptorRequest = (options: Omit<HttpInitSlice, "url">) => Promisable<Omit<HttpInitSlice, "url">>;

/** Interceptor that can modify a `Response` after it is received. */
export type HttpInterceptorResponse = (response: Response) => Promisable<Response>;

/** Interceptor that transforms the parsed response data. */
export type HttpInterceptorTransform = (data: Record<string, unknown>) => Promisable<any>;

/** Interceptor that handles errors from requests. */
export type HttpInterceptorError = (error: unknown) => Promisable<any>;

/** Tuple type for registering interceptors by phase. */
export type HttpInterceptorParameters =
  | ["request", HttpInterceptorRequest]
  | ["response", HttpInterceptorResponse]
  | ["transform", HttpInterceptorTransform]
  | ["error", HttpInterceptorError];

export interface HttpInitInterceptors {
  transform?: MaybeArray<HttpInterceptorTransform>;
  request?: MaybeArray<HttpInterceptorRequest>;
  response?: MaybeArray<HttpInterceptorResponse>;
  error?: MaybeArray<HttpInterceptorError>;
}

export interface HttpInit extends HttpInitNext, HttpInitCf, HttpInitInterceptors {
  url: string;
  method?: HttpMethod;
  query?: Record<string, string | number | boolean | null | undefined>;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
  credentials?: HttpCredentials;
  cache?: HttpCache;
  mode?: HttpMode;
  redirect?: HttpRedirect;
  referrer?: string;
  referrerPolicy?: HttpReferrerPolicy;
  integrity?: string;
  keepalive?: boolean;
  priority?: HttpPriority;
  duplex?: HttpDuplex;
  window?: null;
  dispatcher?: unknown;
}

const initKeys = {
  interceptors: [
    "request",
    "response",
    "transform",
    "error",
  ],
  next: ["revalidate", "tags"],
  cf: [
    "cacheEverything",
    "cacheTtl",
    "cacheKey",
    "cacheTtlByStatus",
    "cacheTags",
    "resolveOverride",
    "image",
    "apps",
    "scrapeShield",
    "polish",
    "minify",
    "colo",
  ]
} as const;

type NextKeys = typeof initKeys.next[number];
type interceptorKeys = HttpInterceptorParameters[0];
type CfKeys = typeof initKeys.cf[number];

export type HttpInitSlice = Omit<
  HttpInit,
  | keyof HttpInitNext
  | keyof HttpInitCf
  | keyof HttpInitInterceptors
> & {
  next?: HttpInitNext;
  cf?: HttpInitCf;
  interceptors?: HttpInitInterceptors;
}

export function getHttpInitSlice(init: Partial<HttpInit>) {
  const configs: Record<string, unknown> = {};

  const next: Record<string, unknown> = {};
  const cf: Record<string, unknown> = {};
  const interceptors: Partial<Record<
    HttpInterceptorParameters[0],
    HttpInterceptorParameters[1]
  >> = {};

  Object.entries(init).forEach(([k, v]) => {
    if (initKeys.next.includes(k as NextKeys)) {
      next[k] = v;
    } else if (initKeys.interceptors.includes(k as interceptorKeys)) {
      interceptors[k as interceptorKeys] = v as HttpInterceptorParameters[1];
    } else if (initKeys.cf.includes(k as CfKeys)) {
      cf[k] = v;
    } else {
      configs[k] = v;
    }
  });

  if (Object.keys(next).length) {
    configs.next = next;
  }

  if (Object.keys(cf).length) {
    configs.cf = cf;
  }

  if (Object.keys(interceptors)) {
    configs.interceptors = interceptors;
  }

  return configs as HttpInitSlice;
}
