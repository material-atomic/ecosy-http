/* eslint-disable @typescript-eslint/no-explicit-any */
import { objectToFormData } from "./utils/formdata";
import { flatten } from "./utils/flatten";
import { isFileList, type FileListLike } from "./utils/filelist";
import { sanitizeMime } from "./utils/sanitize-mime";
import { asArray } from "./array";
import { getHttpInitSlice, type HttpInitSlice } from "./init";
import { Methods } from "./method";
import { HttpUtils } from "./utils";
import type { HttpInit } from "./init";
import type { HttpResponse } from "./response";
import type { HttpRequest } from "./request";

declare var XMLHttpRequest: any;

export interface HttpProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface HttpUploadOptions extends Pick<
  HttpRequest,
  "headers" | "params" | "signal" | "query"
> {
  onProgress?: (progress: HttpProgress) => void;
  name?: string;
  body?: Record<string, unknown>;
}

export interface HttpRelatedOptions
  extends Pick<HttpRequest, "headers" | "params" | "signal" | "query"> {
  metadata: Record<string, unknown>;
  metadataMimeType?: string;
  contentType: string;
}

import { HttpCore } from "./http-core";

export abstract class HttpXML extends HttpCore {
  static upload<DataType = unknown, Err = unknown>(
    url: string,
    file: File | File[] | FileListLike,
    options?: HttpUploadOptions & Omit<HttpInit, "url" | "method" | "body">,
  ): Promise<HttpResponse<DataType, Err>> {
    const formData = options?.body ? objectToFormData(options.body) : new FormData();
    let fileName = options?.name || "file";

    if (Array.isArray(file)) {
      if (fileName.endsWith("[]")) {
        fileName = fileName.slice(0, -2);
      }
      file.forEach((f, index) => {
        formData.append(`${fileName}[${index}]`, f, f.name);
      });
    } else if (isFileList(file)) {
      if (fileName.endsWith("[]")) fileName = fileName.slice(0, -2);
      Array.from(file).forEach((f, index) => {
        formData.append(`${fileName}[${index}]`, f, f.name);
      });
    } else {
      formData.append(fileName, file as File, (file as File).name);
    }

    if (options?.body) {
      const flattenedBody = flatten(options.body);
      Object.entries(flattenedBody).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, String(value));
        }
      });
    }

    if (options?.onProgress && typeof XMLHttpRequest !== "undefined") {
      return new Promise<HttpResponse<DataType, Err>>(async (resolve) => {
        try {
          const initRequest: HttpInit = {
            ...(options as unknown as HttpInit),
            method: Methods.POST,
            url,
            body: formData,
          };
          const { interceptors, ...rest } = getHttpInitSlice(initRequest);
          let modifiedOptions = { ...rest } as Omit<HttpInitSlice, "url">;
          
          const requestInterceptors = asArray(interceptors?.request ?? []);
          for (const interceptor of requestInterceptors) {
            modifiedOptions = await interceptor(modifiedOptions);
          }

          const fullURL = HttpUtils.normalizeURL(modifiedOptions as HttpInit);
          const requestHeaders = HttpUtils.normalizeHeaders(modifiedOptions.headers || {}, true);

          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener("progress", (event: { lengthComputable: boolean; loaded: number; total: number }) => {
            if (event.lengthComputable) {
              const percentage = Math.round((event.loaded / event.total) * 100);
              options.onProgress?.({
                loaded: event.loaded,
                total: event.total,
                percentage,
              });
            }
          });

          xhr.addEventListener("load", async () => {
            try {
              const contentType = xhr.getResponseHeader("Content-Type") || "";
              let originalData: unknown = null;

              if (contentType.includes("application/json")) {
                originalData = JSON.parse(xhr.responseText);
              } else {
                originalData = xhr.responseText;
              }

              const transformInterceptors = asArray(interceptors?.transform ?? []);
              let data = originalData as DataType;
              for (const transform of transformInterceptors) {
                data = await transform(data as Record<string, unknown>);
              }

              const responseInterceptors = asArray(interceptors?.response ?? []);
              let modifiedResponse: Response = new Response(xhr.responseText, {
                status: xhr.status,
                statusText: xhr.statusText,
              });
              for (const interceptor of responseInterceptors) {
                modifiedResponse = await interceptor(modifiedResponse);
              }

              const resultHeaders: Record<string, string> = {};
              modifiedResponse.headers.forEach((value, key) => {
                resultHeaders[key] = value;
              });

              const success = modifiedResponse.ok || (xhr.status >= 200 && xhr.status < 300);
              let error: Err | null = null;
              if (!success) {
                error = (originalData as { error: Err }).error || (originalData as Err);
                const errorInterceptors = asArray(interceptors?.error ?? []);
                for (const errorHandler of errorInterceptors) {
                  error = await errorHandler(error);
                }
              }

              resolve({
                data,
                success,
                error: success ? null : (error as Err),
                status: modifiedResponse.status,
                statusText: modifiedResponse.statusText,
                headers: resultHeaders,
              });
            } catch (err) {
              resolve({
                data: null as unknown as DataType,
                success: false,
                status: xhr.status,
                statusText: xhr.statusText,
                headers: {},
                error: err as Err,
              });
            }
          });

          xhr.addEventListener("error", () => {
            resolve({
              data: null as unknown as DataType,
              success: false,
              status: xhr.status,
              statusText: xhr.statusText || "Network Error",
              headers: {},
              error: new Error("Network Error") as Err,
            });
          });

          xhr.open(modifiedOptions.method || Methods.POST, fullURL, true);
          Object.entries(requestHeaders).forEach(([key, value]) => {
            xhr.setRequestHeader(key, value);
          });
          xhr.send(formData);
        } catch (err) {
          resolve({
            data: null as unknown as DataType,
            success: false,
            status: 0,
            statusText: "Error",
            headers: {},
            error: err as Err,
          });
        }
      });
    }

    return this.request({
      ...(options as unknown as HttpInit),
      method: Methods.POST,
      url,
      body: formData,
    });
  }

  static related<DataType = unknown, Err = unknown>(
    url: string,
    fileData: ArrayBuffer | Uint8Array,
    options: HttpRelatedOptions & Omit<HttpInit, "url" | "method" | "body">,
  ): Promise<HttpResponse<DataType, Err>> {
    const contentType = sanitizeMime(options.contentType);
    const metadataMimeType = sanitizeMime(options.metadataMimeType || "application/json");

    const boundary = `----related-boundary-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const metadataJson = JSON.stringify(options.metadata);

    const encoder = new TextEncoder();
    const metadataPart = encoder.encode(
      `--${boundary}\r\n` +
        `Content-Type: ${metadataMimeType}; charset=UTF-8\r\n\r\n` +
        metadataJson +
        "\r\n",
    );

    const filePart = encoder.encode(
      `--${boundary}\r\n` +
        `Content-Type: ${contentType}\r\n` +
        "Content-Transfer-Encoding: binary\r\n\r\n",
    );

    const closing = encoder.encode(`\r\n--${boundary}--`);
    const fileBytes = fileData instanceof Uint8Array ? fileData : new Uint8Array(fileData);

    const body = new Uint8Array(
      metadataPart.length + filePart.length + fileBytes.length + closing.length,
    );
    [metadataPart, filePart, fileBytes, closing].reduce((offset, part) => {
      body.set(part, offset);
      return offset + part.length;
    }, 0);

    return this.request({
      ...(options as unknown as HttpInit),
      method: Methods.POST,
      url,
      body: body as unknown,
      headers: {
        ...(options.headers || {}),
        "Content-Type": `multipart/related; boundary=${boundary}`,
      } as Record<string, string>,
    });
  }
}
