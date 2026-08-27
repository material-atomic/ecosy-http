import { isFileList } from "./filelist";

/** Type guard that checks whether a value is a `FormData` instance. */
export function isFormData(body: unknown): body is FormData {
  return body instanceof FormData;
}

/**
 * Recursively converts a value into a `FormData` instance.
 * Handles Date, File, Blob, FileList, arrays, nested objects, and primitives.
 *
 * @param data - The value to convert.
 * @param formData - The `FormData` instance to append to (created automatically if omitted).
 * @param parentKey - Internal key prefix for recursive nesting.
 * @returns The populated `FormData` instance.
 *
 * @example
 * ```ts
 * const fd = objectToFormData({
 *   name: "Alice",
 *   avatar: someFile,
 *   tags: ["a", "b"],
 *   meta: { role: "admin" },
 * });
 * // FormData entries:
 * // name        → "Alice"
 * // avatar      → File
 * // tags[0]     → "a"
 * // tags[1]     → "b"
 * // meta[role]  → "admin"
 * ```
 */
export function objectToFormData(
  data: unknown,
  formData = new FormData(),
  parentKey = "",
): FormData {
  // Skip null or undefined values
  if (data === null || data === undefined) {
    return formData;
  }

  // 1. Handle Date
  if (data instanceof Date) {
    formData.append(parentKey, data.toISOString());
  }
  // 2. Handle single File or Blob
  else if (data instanceof File || data instanceof Blob) {
    formData.append(parentKey, data);
  }
  // 3. Handle FileList (isomorphic-safe for Node.js)
  else if (isFileList(data)) {
    Array.from(data).forEach((file, index) => {
      // Backend typically expects array files as: files[0], files[1]
      const arrayKey = parentKey ? `${parentKey}[${index}]` : String(index);
      formData.append(arrayKey, file, file.name);
    });
  }
  // 4. Handle regular arrays
  else if (Array.isArray(data)) {
    data.forEach((item, index) => {
      const arrayKey = parentKey ? `${parentKey}[${index}]` : String(index);
      objectToFormData(item, formData, arrayKey);
    });
  }
  // 5. Handle nested objects
  else if (typeof data === "object") {
    Object.entries(data).forEach(([key, value]) => {
      const propKey = parentKey ? `${parentKey}[${key}]` : key;
      objectToFormData(value, formData, propKey);
    });
  }
  // 6. Handle primitives (string, number, boolean)
  else {
    formData.append(parentKey, String(data));
  }

  return formData;
}
