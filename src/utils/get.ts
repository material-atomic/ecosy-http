/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Safely retrieves a nested value from an object using a dot/bracket path.
 * Returns `defaultValue` only when the resolved value is `undefined` —
 * falsy values like `null`, `0`, `false`, and `""` are returned as-is.
 *
 * @param data - The source object to traverse.
 * @param path - Dot-notation string (`"a.b.c"`), bracket-notation (`"a[0].b"`), or an array of keys.
 * @param defaultValue - Value returned when the path resolves to `undefined`.
 * @returns The resolved value, or `defaultValue` if not found.
 *
 * @example
 * ```ts
 * const obj = { users: [{ name: "Alice" }] };
 *
 * get(obj, "users[0].name");          // "Alice"
 * get(obj, "users.0.name");           // "Alice"
 * get(obj, "users[1].name", "N/A");   // "N/A"
 * get(obj, "count", 0);               // 0
 * ```
 */
export function get<Type = unknown>(
  data: unknown,
  path: string | string[],
  defaultValue?: Type,
): Type {
  // 1. Short-circuit if data is nullish
  if (data === null || data === undefined) {
    return defaultValue as Type;
  }

  // 2. Normalize path into an array of keys
  // Handles both dot notation ("a.b") and bracket notation ("a[0]")
  const keys = Array.isArray(path)
    ? path
    : path
        .replace(/\[(\d+)]/g, ".$1") // Convert "users[0]" to "users.0"
        .split(".")
        .filter(Boolean); // Remove empty segments from leading/trailing dots

  if (keys.length === 0) {
    return data as Type;
  }

  // 3. Traverse the object tree
  let result: any = data;

  for (const key of keys) {
    // Stop early if we hit null/undefined mid-path
    if (result === null || result === undefined) {
      return defaultValue as Type;
    }
    result = result[key];
  }

  // 4. Return defaultValue only for undefined; null, 0, false, "" are valid results
  return result === undefined ? (defaultValue as Type) : (result as Type);
}
