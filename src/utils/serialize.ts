import type { Freezable, LiteralObject } from "../types/built-in";
import { freeze } from "./freeze";
import { get } from "./get";
import { isLiteralObject, isObjectable } from "./object";

type Primitive = string | number | boolean | null | undefined | symbol | bigint;

/** Options for {@link Serialize.queryString.stringify}. */
export interface SerializeQueryOptions {
  /** Array serialization format. Defaults to `"none"`. */
  arrayFormat?: "bracket" | "index" | "comma" | "separator" | "none";
  /** Separator character when `arrayFormat` is `"separator"`. Defaults to `","`. */
  arrayFormatSeparator?: string;
  /** Skip keys whose value is `null` or `undefined`. */
  skipNull?: boolean;
  /** Skip keys whose value is an empty string. */
  skipEmptyString?: boolean;
  /** Whether to URL-encode keys and values, or a custom encoder function. Defaults to `true`. */
  encode?: boolean | ((value: string) => string);
  /** Reject keys with non-standard characters when `true`. Defaults to `true`. */
  strict?: boolean;
  /** Sort keys alphabetically, or provide a custom comparator. */
  sort?: boolean | ((a: string, b: string) => number);
}

type SerializePrimitive = Freezable<{
  isString(value: unknown): value is string;
  isNumber(value: unknown): value is number;
  isBoolean(value: unknown): value is boolean;
  isPrimitive(value: unknown): value is Primitive;
  isDate(value: unknown): value is Date;
  isPlainObject(value: unknown): value is LiteralObject;
}>;


type SerializeURL = Freezable<{
  encode(value: string, component?: boolean | ((value: string) => string)): string;
  decode(value: string, component?: boolean | ((value: string) => string)): string;
  build(uri: string, params?: Record<string, Primitive> | null): string;
}>;

type SerializeQueryString = Freezable<{
  parse(query: string): Record<string, string>;
  stringify(params: Record<string, unknown>, options?: SerializeQueryOptions): string;
}>;

/**
 * Centralized serialization engine and type-guard toolkit.
 * Addresses common pitfalls of `JSON.stringify`/`JSON.parse` — BigInt safety,
 * Date preservation, undefined stripping, and safe URL encoding/decoding.
 *
 * All methods are organized into frozen static getters:
 * - `Serialize.Primitive` — type guards and deep normalization
 * - `Serialize.URL` — encode/decode/build with malformed-char recovery
 * - `Serialize.queryString` — parse and stringify query strings
 *
 * @example
 * ```ts
 * Serialize.URL.encode("hello world");
 * Serialize.queryString.stringify({ page: 1, tags: ["a", "b"] });
 * ```
 */
export class Serialize {
  /**
   * Interpolates `{key}` placeholders in a string using deep path resolution via {@link get}.
   * Objects are silently replaced with empty strings to avoid `[object Object]`.
   *
   * @param pattern - Template string with `{key}` or `{path.to.key}` placeholders.
   * @param params - Data object or array to resolve values from.
   * @returns The interpolated string.
   */
  static interpolate(
    pattern: string,
    params: Record<string, unknown> | Array<unknown> = {},
  ): string {
    // Fast-path: skip processing if no placeholders
    if (
      !pattern ||
      typeof pattern !== "string" ||
      !pattern.trim().length ||
      !pattern.includes("{") ||
      !pattern.includes("}")
    ) {
      return pattern;
    }

    // Scan for placeholders and resolve lazily via `get`
    return pattern.replace(/\{([a-zA-Z0-9_.-]+)\}/g, (match, variable) => {
      const value = get(params, variable);

      // Unresolved placeholders become empty strings
      if (value === null || value === undefined) {
        return "";
      }

      // Prevent "[object Object]" — only render primitives
      if (typeof value === "object") {
        return "";
      }

      return String(value);
    });
  }

  /** Type guards and deep normalization utilities. */
  private static _primitive: SerializePrimitive;
  static get Primitive() {
    return (Serialize._primitive ??= freeze({
      isString: (value: unknown): value is string => {
        return typeof value === "string";
      },
      isNumber(value: unknown): value is number {
        return typeof value === "number" && Number.isFinite(value);
      },
      isBoolean(value: unknown): value is boolean {
        return typeof value === "boolean";
      },
      isPrimitive(value: unknown): value is Primitive {
        return !isObjectable(value);
      },
      isDate(value: unknown): value is Date {
        return value instanceof Date && !Number.isNaN(value.getTime());
      },
      isPlainObject: isLiteralObject,
    }));
  }

  /** Safe JSON stringify/parse that never throws. */
  /** URL encoding/decoding with malformed-character recovery. */
  private static _URL: SerializeURL;
  static get URL() {
    return (Serialize._URL ??= freeze({
      encode(value: string, component: boolean | ((value: string) => string) = true): string {
        if (!value) return "";
        if (typeof component === "function") return component(value);

        try {
          return component ? encodeURIComponent(value) : encodeURI(value);
        } catch {
          // Strip broken surrogate chars and retry instead of crashing
          const sanitized = value.replace(/[\uD800-\uDFFF]/g, "");
          return component ? encodeURIComponent(sanitized) : encodeURI(sanitized);
        }
      },
      decode: (value: string, component: boolean | ((value: string) => string) = true): string => {
        if (!value) return "";
        if (typeof component === "function") return component(value);

        const decoder = component ? decodeURIComponent : decodeURI;
        const normalized = component ? value.replace(/\+/g, "%20") : value;

        return normalized.replace(/(%[0-9A-F]{2})+/gi, (match) => {
          try {
            return decoder(match);
          } catch {
            console.warn(`[Serialize.URL] Cannot decode part: ${match}`);
            return match; // Keep broken parts intact, recover what we can
          }
        });
      },
      build: (uri: string, params: Record<string, Primitive> | null | undefined): string => {
        if (!uri) return "";
        if (!params || typeof params !== "object") return uri;

        // Single-pass regex replace for maximum speed
        return uri.replace(/:([a-zA-Z\d_]+)/g, (fullMatch, key) => {
          const value = params[key];

          // If param is not provided, keep the ":key" placeholder
          if (value === null || value === undefined) {
            return fullMatch;
          }

          // Auto-encode the value using the same URL encoder
          return Serialize.URL.encode(String(value), true);
        });
      },
    }));
  }

  /** Query string parse/stringify with configurable array formats. */
  private static _queryString: SerializeQueryString;
  static get queryString() {
    return (Serialize._queryString ??= freeze({
      parse(query: string): Record<string, string> {
        if (!query) return {};
        const cleanQuery = query.startsWith("?") ? query.slice(1) : query;
        const result: Record<string, string> = {};

        cleanQuery.split("&").forEach((part) => {
          if (!part) return;
          const [key, value] = part.split("=");
          if (key) {
            result[Serialize.URL.decode(key)] = value ? Serialize.URL.decode(value) : "";
          }
        });

        return result;
      },
      stringify(params: Record<string, unknown>, options: SerializeQueryOptions = {}): string {
        if (params === null || typeof params !== "object") return "";

        const {
          arrayFormat = "none",
          arrayFormatSeparator = ",",
          skipNull = false,
          skipEmptyString = false,
          encode = true,
          strict = true,
          sort = false,
        } = options;

        const isValidKey = (k: string) => k.length > 0 && /^[a-zA-Z0-9_\-.[\]]+$/.test(k);

        // Internal encode wrapper
        const encoder = (val: string): string => {
          if (!encode) return val;
          return Serialize.URL.encode(val, encode);
        };

        const resultPairs: string[] = [];

        // Flat recursion — traverse arrays and nested objects
        const traverse = (prefix: string, obj: unknown) => {
          if (Array.isArray(obj)) {
            if (arrayFormat === "comma" || arrayFormat === "separator") {
              const validVals = obj.filter((v) => v !== null && v !== undefined && v !== "");
              if (validVals.length > 0) {
                resultPairs.push(
                  `${encoder(prefix)}=${encoder(validVals.map(String).join(arrayFormatSeparator))}`,
                );
              }
              return;
            }
            obj.forEach((val, idx) => {
              let arrayKey = prefix;
              if (arrayFormat === "bracket") arrayKey = `${prefix}[]`;
              else if (arrayFormat === "index") arrayKey = `${prefix}[${idx}]`;
              traverse(arrayKey, val);
            });
            return;
          }

          if (Serialize.Primitive.isPlainObject(obj)) {
            for (const subKey in obj) {
              if (Object.prototype.hasOwnProperty.call(obj, subKey)) {
                traverse(`${prefix}[${subKey}]`, obj[subKey as keyof typeof obj]);
              }
            }
            return;
          }

          // Primitive formatting
          if (obj === null || obj === undefined) {
            if (!skipNull) resultPairs.push(`${encoder(prefix)}=`);
            return;
          }
          if (obj === "") {
            if (!skipEmptyString) resultPairs.push(`${encoder(prefix)}=`);
            return;
          }
          if (typeof obj === "boolean") {
            resultPairs.push(`${encoder(prefix)}=${obj ? "true" : "false"}`);
            return;
          }
          if (Serialize.Primitive.isDate(obj)) {
            resultPairs.push(`${encoder(prefix)}=${encoder(obj.toISOString())}`);
            return;
          }

          resultPairs.push(`${encoder(prefix)}=${encoder(String(obj))}`);
        };

        // Run the top-level iteration
        let keys = Object.keys(params);
        if (sort) keys = typeof sort === "function" ? keys.sort(sort) : keys.sort();

        for (const key of keys) {
          if (strict && !isValidKey(key)) continue;
          traverse(key, params[key]);
        }

        return resultPairs.join("&");
      },
    }));
  }
}
