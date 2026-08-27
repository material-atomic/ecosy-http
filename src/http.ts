/* eslint-disable @typescript-eslint/no-explicit-any */
import { Methods, type HttpMethod } from "./method";
import { HttpStatic } from "./http-static";
import { HttpXML } from "./xml";
import { Endpoint } from "./endpoint";
import { HttpUtils } from "./utils";
import type { HttpInit } from "./init";
import type { HttpResponse } from "./response";
import type { HttpUploadOptions, HttpRelatedOptions } from "./xml";
import type { 
  HttpInterceptorRequest, 
  HttpInterceptorResponse, 
  HttpInterceptorTransform, 
  HttpInterceptorError,
  HttpInterceptorParameters,
} from "./init";
import type { FileListLike } from "./utils/filelist";

const DEFAULT_BASE_URL = "/";

export interface HttpOptions {
  baseURL?: string;
  allowedOrigins?: ReadonlyArray<string>;
  configs?: Record<string, unknown>;
}

export class Http extends HttpStatic {
  static readonly method = Methods;
  static readonly Endpoint = Endpoint;

  private static interceptors = {
    request: [] as HttpInterceptorRequest[],
    response: [] as HttpInterceptorResponse[],
    transform: [] as HttpInterceptorTransform[],
    error: [] as HttpInterceptorError[],
  };

  public readonly method = Http.method;
  public baseURL: string;
  private readonly allowedOrigins: ReadonlySet<string>;
  private readonly defaultConfigs: Record<string, unknown>;
  private defaultHeaders: Record<string, string> = {};

  private interceptors = {
    request: [] as HttpInterceptorRequest[],
    response: [] as HttpInterceptorResponse[],
    transform: [] as HttpInterceptorTransform[],
    error: [] as HttpInterceptorError[],
  };

  constructor(init?: string | HttpOptions) {
    super();
    const resolved: HttpOptions =
      typeof init === "string" || init === undefined
        ? { baseURL: init ?? DEFAULT_BASE_URL }
        : init;

    this.baseURL = resolved.baseURL ?? DEFAULT_BASE_URL ?? "/";

    const origins = new Set<string>();
    for (const o of resolved.allowedOrigins ?? []) {
      const origin = HttpUtils.safeOrigin(o);
      if (!origin) throw new Error(`Http: invalid allowedOrigins entry: ${o}`);
      origins.add(origin);
    }
    const baseOrigin = HttpUtils.safeOrigin(this.baseURL);
    if (baseOrigin) origins.add(baseOrigin);
    this.allowedOrigins = origins;

    this.defaultConfigs = resolved.configs || {};
    
    // Register allowed origins globally for safe redirects
    origins.forEach(origin => HttpUtils.AllowedOrigins.add(origin));
  }

  static on(...params: HttpInterceptorParameters) {
    const [type, handler] = params;
    const registered = Http.interceptors[type] as unknown[];
    registered.includes(handler) || registered.push(handler);
    Http.interceptors[type] = registered as Array<any>;
  }

  static off(...params: HttpInterceptorParameters) {
    const [type, handler] = params;
    const registered = Http.interceptors[type] as unknown[];
    Http.interceptors[type] = registered.filter((h) => h !== handler) as Array<any>;
  }

  on(...params: HttpInterceptorParameters) {
    const [type, handler] = params;
    const registered = this.interceptors[type] as unknown[];
    registered.includes(handler) || registered.push(handler);
    this.interceptors[type] = registered as Array<any>;
    return this;
  }

  off(...params: HttpInterceptorParameters) {
    const [type, handler] = params;
    const registered = this.interceptors[type] as unknown[];
    this.interceptors[type] = registered.filter((h) => h !== handler) as Array<any>;
    return this;
  }

  addHeaders(headers: Record<string, string>) {
    this.defaultHeaders = {
      ...this.defaultHeaders,
      ...headers,
    };
  }

  private mergeConfig(init: Omit<HttpInit, "url" | "method"> & { url: string; method?: HttpMethod }): HttpInit {
    const mergedRequest = [
      ...Http.interceptors.request,
      ...this.interceptors.request,
      ...(init.request ? (Array.isArray(init.request) ? init.request : [init.request]) : []),
    ];

    const mergedTransform = [
      ...Http.interceptors.transform,
      ...this.interceptors.transform,
      ...(init.transform ? (Array.isArray(init.transform) ? init.transform : [init.transform]) : []),
    ];

    const mergedResponse = [
      ...Http.interceptors.response,
      ...this.interceptors.response,
      ...(init.response ? (Array.isArray(init.response) ? init.response : [init.response]) : []),
    ];

    const mergedError = [
      ...Http.interceptors.error,
      ...this.interceptors.error,
      ...(init.error ? (Array.isArray(init.error) ? init.error : [init.error]) : []),
    ];

    let finalUrl = init.url;
    if (finalUrl.startsWith("//")) {
      throw new Error(`Http: protocol-relative URLs are not allowed: ${finalUrl}`);
    }
    
    if (!/^[a-z][a-z0-9+.-]*:/i.test(finalUrl)) {
      const base = this.baseURL.replace(/\/+$/, "");
      const cleanURL = finalUrl.replace(/^\/+/, "");
      finalUrl = base ? `${base}/${cleanURL}` : `/${cleanURL}`;
    }

    const mergedHeaders = {
      ...this.defaultHeaders,
      ...init.headers,
    };

    return {
      ...this.defaultConfigs,
      ...init,
      url: finalUrl,
      headers: mergedHeaders,
      request: mergedRequest,
      transform: mergedTransform,
      response: mergedResponse,
      error: mergedError,
      method: init.method || Methods.GET,
    };
  }

  request<DataType = unknown, Err = unknown>(init: HttpInit): Promise<HttpResponse<DataType, Err>> {
    return HttpStatic.request<DataType, Err>(this.mergeConfig(init));
  }

  get<DataType = unknown, Err = unknown>(url: string, init?: Omit<HttpInit, "url" | "method">) {
    return this.request<DataType, Err>({ ...init, url, method: Methods.GET });
  }

  post<DataType = unknown, Err = unknown>(url: string, body?: unknown, init?: Omit<HttpInit, "url" | "method" | "body">) {
    return this.request<DataType, Err>({ ...init, url, method: Methods.POST, body });
  }

  put<DataType = unknown, Err = unknown>(url: string, body?: unknown, init?: Omit<HttpInit, "url" | "method" | "body">) {
    return this.request<DataType, Err>({ ...init, url, method: Methods.PUT, body });
  }

  patch<DataType = unknown, Err = unknown>(url: string, body?: unknown, init?: Omit<HttpInit, "url" | "method" | "body">) {
    return this.request<DataType, Err>({ ...init, url, method: Methods.PATCH, body });
  }

  delete<DataType = unknown, Err = unknown>(url: string, body?: unknown, init?: Omit<HttpInit, "url" | "method" | "body">) {
    return this.request<DataType, Err>({ ...init, url, method: Methods.DELETE, body });
  }

  head<DataType = unknown, Err = unknown>(url: string, init?: Omit<HttpInit, "url" | "method">) {
    return this.request<DataType, Err>({ ...init, url, method: Methods.HEAD });
  }

  options<DataType = unknown, Err = unknown>(url: string, init?: Omit<HttpInit, "url" | "method">) {
    return this.request<DataType, Err>({ ...init, url, method: Methods.OPTIONS });
  }

  upload<DataType = unknown, Err = unknown>(
    url: string,
    file: File | File[] | FileListLike,
    options?: HttpUploadOptions & Omit<HttpInit, "url" | "method" | "body">,
  ) {
    return HttpXML.upload<DataType, Err>(url, file, this.mergeConfig({ ...options, url, method: Methods.POST }) as any);
  }

  related<DataType = unknown, Err = unknown>(
    url: string,
    fileData: ArrayBuffer | Uint8Array,
    options: HttpRelatedOptions & Omit<HttpInit, "url" | "method" | "body">,
  ) {
    return HttpXML.related<DataType, Err>(url, fileData, this.mergeConfig({ ...options, url, method: Methods.POST }) as any);
  }
}
