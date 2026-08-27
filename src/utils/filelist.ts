import { isFunction } from "./is-function";
import { toString } from "./string";

/**
 * A platform-agnostic interface representing a `FileList`-like object.
 * Works in both browser (native `FileList`) and Node.js environments.
 */
export interface FileListLike {
  readonly length: number;
  item(index: number): File;
  [index: number]: File;
}

/**
 * Checks whether a value is a `FileList` or a `FileList`-like object.
 * Uses `instanceof FileList` in browser environments and falls back to
 * `Object.prototype.toString` tag detection for isomorphic compatibility.
 *
 * @param data - The value to check.
 * @returns `true` if the value is a `FileList` or has the `[object FileList]` tag.
 *
 * @example
 * ```ts
 * const input = document.querySelector("input[type=file]");
 * isFileList(input.files); // true
 * isFileList([]);           // false
 * ```
 */
export function isFileList(data: unknown): data is FileListLike {
  return (
    (typeof FileList !== "undefined" && data instanceof FileList) ||
    (typeof data === "object" &&
      data !== null &&
      toString(data) === "[object FileList]" &&
      "length" in data &&
      "item" in data &&
      isFunction(data.item))
  );
}
