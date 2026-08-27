/* eslint-disable @typescript-eslint/no-explicit-any */

/** A generic string-keyed record type. */
export type ObjectOf<T = unknown> = Record<string, T>;

/**
 * Recursively flattens a nested object or array into a single-level object
 * with dot-separated keys.
 *
 * Array indices use dot notation (`users.0.name` instead of `users[0].name`).
 *
 * @param data - The value to flatten.
 * @param prefix - Internal prefix for recursive key building.
 * @param acc - Internal accumulator for the result.
 * @returns A flat `Record<string, unknown>` with dot-separated keys.
 *
 * @example
 * ```ts
 * flatten({ users: [{ name: "Alice" }] });
 * // { "users.0.name": "Alice" }
 *
 * flatten({ a: { b: { c: 1 } } });
 * // { "a.b.c": 1 }
 * ```
 */
export function flatten(
  data: unknown,
  prefix = "",
  acc: Record<string, unknown> = {},
): Record<string, unknown> {
  if (typeof data !== "object" || data === null) {
    if (prefix) acc[prefix] = data;
    return acc;
  }

  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      const newPrefix = prefix ? `${prefix}.${i}` : `${i}`;
      flatten(data[i], newPrefix, acc);
    }
  } else {
    for (const [key, value] of Object.entries(data)) {
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      flatten(value, newPrefix, acc);
    }
  }

  return acc;
}

/**
 * Extracts entries from a flattened object under a given path and reconstructs
 * them as an array of objects (if the keys are numeric indices) or a list of
 * `{ key, value }` pairs (if the keys are non-numeric).
 *
 * @param data - A flattened `Record<string, unknown>` (output of {@link flatten}).
 * @param path - The dot-separated path prefix to extract.
 * @returns An array of reconstructed objects, primitive values, or `{ key, value }` pairs.
 *
 * @example
 * ```ts
 * const flat = flatten({ users: [{ name: "Alice" }, { name: "Bob" }] });
 * flattenToArray(flat, "users");
 * // [{ name: "Alice" }, { name: "Bob" }]
 *
 * const flat2 = flatten({ config: { host: "localhost", port: 3000 } });
 * flattenToArray(flat2, "config");
 * // [{ key: "host", value: "localhost" }, { key: "port", value: 3000 }]
 * ```
 */
export function flattenToArray(data: Record<string, unknown>, path: string) {
  const prefix = `${path}.`;

  const dataOfPath = Object.entries(data).filter(([key]) => key.startsWith(prefix));

  if (!dataOfPath.length) return [];

  // Get the first key, strip the prefix. e.g. "0.name"
  const firstKeyRemain = dataOfPath[0][0].replace(prefix, "");

  // Determine if it's an array by checking whether the first node is a numeric index
  const firstNode = firstKeyRemain.split(".")[0];
  const isArrayType = !isNaN(Number(firstNode));

  // Return as { key, value } list if not an array
  if (!isArrayType) {
    return dataOfPath.map(([key, value]) => ({
      key: key.replace(prefix, ""),
      value,
    }));
  }

  // Reconstruct array from "0.name" format
  const resultObj = dataOfPath.reduce(
    (acc, [key, value]) => {
      const cleanedKey = key.replace(prefix, ""); // "0.contact.email"
      const parts = cleanedKey.split(".");

      const index = parts[0]; // "0"
      const remain = parts.slice(1).join("."); // "contact.email"

      if (!acc[index]) acc[index] = {};

      if (remain) {
        acc[index][remain] = value;
      } else {
        acc[index] = value as any; // Handle primitive arrays
      }

      return acc;
    },
    {} as Record<string, any>,
  );

  return Object.values(resultObj);
}

/**
 * Escapes special regex characters in a key string so it can be safely
 * used inside a `RegExp` constructor.
 *
 * @param key - The string to escape.
 * @returns The escaped string with special characters prefixed by `\\`.
 *
 * @example
 * ```ts
 * escapeRegexKey("users[0].name"); // "users\\[0\\]\\.name"
 * ```
 */
export function escapeRegexKey(key: string) {
  return key.replace(/([.[\]{}])/g, "\\$1");
}
