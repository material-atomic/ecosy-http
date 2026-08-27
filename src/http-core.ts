import { isFormData } from "./utils/formdata";
import { asArray } from "./array";
import { getHttpInitSlice, type HttpInitSlice, type HttpInit } from "./init";
import { Methods } from "./method";
import { HttpUtils } from "./utils";
import type { HttpResponse } from "./response";

export abstract class HttpCore {
  static async request<DataType = unknown, Err = unknown>(init: HttpInit): Promise<HttpResponse<DataType, Err>> {
    const { interceptors, ...rest } = getHttpInitSlice(init);

    try {
      let modifiedOptions = { ...rest } as Omit<HttpInitSlice, "url">;
      const requestInterceptors = asArray(interceptors?.request ?? []);

      for (const interceptor of requestInterceptors) {
        modifiedOptions = await interceptor(modifiedOptions);
      }

      const fullURL = HttpUtils.normalizeURL(modifiedOptions as HttpInit);
      const requestHeaders = HttpUtils.normalizeHeaders(modifiedOptions.headers || {}, isFormData(modifiedOptions.body));

      const response = await fetch(fullURL, {
        ...HttpUtils.extractFetchOptions(modifiedOptions),
        method: modifiedOptions.method || Methods.GET,
        headers: requestHeaders,
        body: HttpUtils.normalizeBody(modifiedOptions) as BodyInit | undefined,
        signal: modifiedOptions.signal,
      });

      HttpUtils.assertSameOriginResponse(fullURL, response, requestHeaders);

      const headers = response.headers;
      const contentType = headers.get("Content-Type") || "";
      let originalData: unknown = null;

      if (contentType.includes("application/json")) {
        originalData = (await response.json()) as unknown as DataType;
      } else {
        originalData = (await response.text()) as unknown as DataType;
      }

      const transformInterceptors = asArray(interceptors?.transform ?? []);
      let data = originalData as DataType;

      for (const transform of transformInterceptors) {
        data = await transform(data as Record<string, unknown>);
      }

      const responseInterceptors = asArray(interceptors?.response ?? []);
      let modifiedResponse: Response = response;

      for (const interceptor of responseInterceptors) {
        modifiedResponse = await interceptor(modifiedResponse);
      }

      const resultHeaders: Record<string, string> = {};
      modifiedResponse.headers.forEach((value, key) => {
        resultHeaders[key] = value;
      });

      const success = modifiedResponse.ok;
      let error: Err | null = null;

      if (!success) {
        error = (originalData as { error: Err }).error || (originalData as Err);
        const errorInterceptors = asArray(interceptors?.error ?? []);

        for (const errorHandler of errorInterceptors) {
          error = await errorHandler(error);
        }
      }

      return {
        data,
        success,
        error: success ? null : (error as Err),
        status: modifiedResponse.status,
        statusText: modifiedResponse.statusText,
        headers: resultHeaders,
      };
    } catch (error) {
      let finalError = error instanceof Error ? error : new Error(String(error));
      const errorInterceptors = asArray(interceptors?.error ?? []);

      for (const errorHandler of errorInterceptors) {
        finalError = await errorHandler(finalError);
      }

      return {
        data: null as unknown as DataType,
        status: 0,
        statusText: "Error",
        headers: {},
        error: finalError as Err,
        success: false,
      };
    }
  }
}
