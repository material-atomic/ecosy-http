/* eslint-disable @typescript-eslint/no-explicit-any */
import { type HttpClientOptions, type HttpAction, createClient } from "./client";
import { Http } from "./http";
import type { HttpResponse } from "./response";
import type { HttpInitInterceptors } from "./init";
import { type HttpMethod } from "./method";
import { asArray } from "./array";
import type { EndpointConfig } from "./endpoint";

/**
 * Result structure returned by a Fetcher execution.
 * Contains the raw HttpResponse along with the action key and arguments.
 */
export type FetcherResult<DataType = unknown, Args extends any[] = any[], Err = unknown> = HttpResponse<DataType, Err> & {
  args: Args;
  key: string;
};

/**
 * Middleware function for intercepting and transforming Fetcher execution pipeline.
 */
export type FetcherMiddleware = (
  action: HttpAction<any, any, any>,
  args: any[],
  next: () => Promise<HttpResponse<any, any>>
) => Promise<HttpResponse<any, any>>;

/**
 * Configuration options for initializing a Fetcher builder.
 */
export interface FetcherOptions extends HttpClientOptions {
  request?: HttpInitInterceptors["request"] | HttpInitInterceptors["request"][];
  response?: HttpInitInterceptors["response"] | HttpInitInterceptors["response"][];
  transform?: HttpInitInterceptors["transform"] | HttpInitInterceptors["transform"][];
  error?: HttpInitInterceptors["error"] | HttpInitInterceptors["error"][];
  shouldRetry?: (res: HttpResponse<any, any>, key: string) => boolean | Promise<boolean>;
  onRetry?: (res: HttpResponse<any, any>, key: string) => boolean | Promise<boolean>;
  onResult?: (result: FetcherResult<any, any, any>, config: FetcherOptions) => void | Promise<void>;
  middlewares?: FetcherMiddleware[];
  retryLimit?: number;
}

/**
 * A mutable chaining builder that constructs HTTP clients and pipelines.
 * Acts as both a configuration builder and an action factory/executor.
 */
export interface IFetcherBuilder {
  /** 
   * Creates an unexecuted RAW action descriptor for a given endpoint key.
   * Useful for mapping endpoints before executing them later.
   */
  <T = unknown, Args extends any[] = [], E = unknown>(
    key: string,
    method?: HttpMethod | "upload" | "related"
  ): HttpAction<T, Args, E>; 
  
  /** 
   * Immediately executes an action through the middleware pipeline with arguments as an array.
   */
  execute<T, Args extends any[] = [], E = unknown>(
    action: HttpAction<T, Args, E>, 
    args: Args,
    overrideConfig?: Partial<FetcherOptions>
  ): Promise<FetcherResult<T, Args, E>>;

  /** 
   * Immediately executes an action through the middleware pipeline with rest arguments.
   */
  fetcher<T, Args extends any[] = [], E = unknown>(
    action: HttpAction<T, Args, E>, 
    ...args: Args
  ): Promise<FetcherResult<T, Args, E>>;
  
  /** Adds a request interceptor to the underlying Http instance. */
  request(fn: HttpInitInterceptors["request"]): IFetcherBuilder;
  /** Adds a response interceptor to the underlying Http instance. */
  response(fn: HttpInitInterceptors["response"]): IFetcherBuilder;
  /** Adds a transform interceptor to the underlying Http instance. */
  transform(fn: HttpInitInterceptors["transform"]): IFetcherBuilder;
  /** Adds an error interceptor to the underlying Http instance. */
  error(fn: HttpInitInterceptors["error"]): IFetcherBuilder;
  
  /** Appends one or more middlewares to the execution pipeline. */
  use(...middlewares: FetcherMiddleware[]): IFetcherBuilder;
  /** Configures the condition to check if a response should trigger a retry. */
  shouldRetry(fn: (res: HttpResponse<any, any>, key: string) => boolean | Promise<boolean>): IFetcherBuilder;
  /** Configures the actual retry handler (e.g. refreshing a token). Returns true to retry. */
  retry(fn: (res: HttpResponse<any, any>, key: string) => boolean | Promise<boolean>): IFetcherBuilder;
  /** Global hook invoked when an execution completes (e.g. for persisting to a store). */
  onResult(fn: (result: FetcherResult<any, any, any>, config: FetcherOptions) => void | Promise<void>): IFetcherBuilder;
  /** Overrides or extends the builder's internal configuration. */
  config(options: Partial<FetcherOptions>): IFetcherBuilder;
  
  /** Sets the base URL for the client. */
  baseURL(url: string): IFetcherBuilder;
  /** Sets the endpoint resolver function for the client. */
  endpoint(fn: HttpClientOptions["endpoint"]): IFetcherBuilder;
  /** Registers endpoints for a service, or multiple services at once. */
  register(serviceOrConfigs: string | Record<string, EndpointConfig>, endpoints?: EndpointConfig): IFetcherBuilder;
  
  /** The underlying HTTP instance associated with this builder. */
  readonly http: Http;
}

/**
 * Initializes a new Fetcher Builder.
 * 
 * @example
 * ```ts
 * const api = Fetcher({ baseURL: "https://api.example.com" })
 *   .use(loggerPlugin())
 *   .retry(async (res, key) => await handleAuth(res));
 * 
 * const userAction = api("users.me");
 * const res = await api.execute(userAction, []);
 * ```
 */
function _Fetcher(initialOptions: FetcherOptions | string = {}): IFetcherBuilder {
  const options = typeof initialOptions === "string" ? { baseURL: initialOptions } : { ...initialOptions };
  options.middlewares = [...(options.middlewares || [])];
  
  const httpInstance = options.http || new Http(options.baseURL);

  const addArray = <T>(arr: T | T[] | undefined, cb: (item: T) => void) => {
    if (!arr) return;
    const items = asArray(arr);
    items.forEach(cb);
  };

  addArray(options.request, fn => httpInstance.on("request", fn as any));
  addArray(options.response, fn => httpInstance.on("response", fn as any));
  addArray(options.transform, fn => httpInstance.on("transform", fn as any));
  addArray(options.error, fn => httpInstance.on("error", fn as any));

  // Mutable Builder: Khi gọi trực tiếp sẽ trả về raw action (tương đương factory cũ)
  const builder = function <T = unknown, Args extends any[] = [], E = unknown>(
    key: string,
    method?: HttpMethod | "upload" | "related"
  ): HttpAction<T, Args, E> {
    const rawClientFactory = createClient({
      http: httpInstance,
      baseURL: options.baseURL,
      endpoint: options.endpoint,
    });
    
    return rawClientFactory<T, Args, E>(key, method);
  } as IFetcherBuilder;

  // Cài đặt execute (chạy pipeline)
  builder.execute = async function <T = unknown, Args extends any[] = [], E = unknown>(
    action: HttpAction<T, Args, E>, 
    args: Args,
    overrideConfig: Partial<FetcherOptions> = {}
  ): Promise<FetcherResult<T, Args, E>> {
    const runConfig = { ...options, ...overrideConfig };
    
    let index = -1;
    const middlewares = runConfig.middlewares || [];

    const dispatch = async (i: number): Promise<HttpResponse<any, any>> => {
      if (i <= index) throw new Error("next() called multiple times");
      index = i;
      let mw = middlewares[i];
      if (i === middlewares.length) {
        mw = async (act, a) => await act.fn(...a);
      }
      if (!mw) return undefined as any;
      return await mw(action as any, args, () => dispatch(i + 1));
    };

    let res = await dispatch(0) as HttpResponse<T, E>;
    
    let retries = 0;
    const retryLimit = runConfig.retryLimit ?? 1;

    while (
      retries < retryLimit && 
      runConfig.shouldRetry && 
      await runConfig.shouldRetry(res, action.key)
    ) {
      const willRetry = runConfig.onRetry ? await runConfig.onRetry(res, action.key) : true;
      if (!willRetry) break;

      retries++;
      res = await action.fn(...args);
    }

    const result = {
      ...res,
      args,
      key: action.key,
    } as FetcherResult<T, Args, E>;

    if (runConfig.onResult) {
      await runConfig.onResult(result, runConfig);
    }

    return result;
  };

  // Cài đặt fetcher (bọc execute)
  builder.fetcher = async function <T = unknown, Args extends any[] = [], E = unknown>(
    action: HttpAction<T, Args, E>, 
    ...args: Args
  ): Promise<FetcherResult<T, Args, E>> {
    return builder.execute(action, args);
  };

  // Gắn các chain methods lên function object
  builder.use = (...middlewares: FetcherMiddleware[]) => {
    options.middlewares!.push(...middlewares);
    return builder;
  };
  builder.request = (fn) => { httpInstance.on("request", fn as any); return builder; };
  builder.response = (fn) => { httpInstance.on("response", fn as any); return builder; };
  builder.transform = (fn) => { httpInstance.on("transform", fn as any); return builder; };
  builder.error = (fn) => { httpInstance.on("error", fn as any); return builder; };
  builder.shouldRetry = (fn) => { options.shouldRetry = fn; return builder; };
  builder.retry = (fn) => { options.onRetry = fn; return builder; };
  builder.onResult = (fn) => { options.onResult = fn; return builder; };
  builder.config = (opts) => { Object.assign(options, opts); return builder; };
  builder.baseURL = (url) => { 
    options.baseURL = url; 
    httpInstance.baseURL = url;
    return builder; 
  };
  builder.endpoint = (fn) => { options.endpoint = fn; return builder; };
  builder.register = (serviceOrConfigs: any, endpoints?: any) => { Http.Endpoint.register(serviceOrConfigs, endpoints); return builder; };
  
  Object.defineProperty(builder, 'http', {
    get: () => httpInstance
  });

  return builder;
}

export const Fetcher = Object.assign(_Fetcher, {
  baseURL(url: string): IFetcherBuilder {
    return _Fetcher().baseURL(url);
  },
  endpoint(fn: HttpClientOptions["endpoint"]): IFetcherBuilder {
    return _Fetcher().endpoint(fn);
  },
  register(serviceOrConfigs: any, endpoints?: any): IFetcherBuilder {
    return _Fetcher().register(serviceOrConfigs, endpoints);
  }
});
