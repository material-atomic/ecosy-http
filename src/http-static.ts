import { Methods } from "./method";
import { HttpXML } from "./xml";
import type { HttpInit } from "./init";

export abstract class HttpStatic extends HttpXML {
  static method = Methods;

  static get<DataType = unknown, Err = unknown>(url: string, init?: Omit<HttpInit, "url" | "method">) {
    return this.request<DataType, Err>({ ...init, url, method: Methods.GET });
  }

  static post<DataType = unknown, Err = unknown>(url: string, body?: unknown, init?: Omit<HttpInit, "url" | "method" | "body">) {
    return this.request<DataType, Err>({ ...init, url, method: Methods.POST, body });
  }

  static put<DataType = unknown, Err = unknown>(url: string, body?: unknown, init?: Omit<HttpInit, "url" | "method" | "body">) {
    return this.request<DataType, Err>({ ...init, url, method: Methods.PUT, body });
  }

  static patch<DataType = unknown, Err = unknown>(url: string, body?: unknown, init?: Omit<HttpInit, "url" | "method" | "body">) {
    return this.request<DataType, Err>({ ...init, url, method: Methods.PATCH, body });
  }

  static delete<DataType = unknown, Err = unknown>(url: string, body?: unknown, init?: Omit<HttpInit, "url" | "method" | "body">) {
    return this.request<DataType, Err>({ ...init, url, method: Methods.DELETE, body });
  }

  static head<DataType = unknown, Err = unknown>(url: string, init?: Omit<HttpInit, "url" | "method">) {
    return this.request<DataType, Err>({ ...init, url, method: Methods.HEAD });
  }

  static options<DataType = unknown, Err = unknown>(url: string, init?: Omit<HttpInit, "url" | "method">) {
    return this.request<DataType, Err>({ ...init, url, method: Methods.OPTIONS });
  }
}
