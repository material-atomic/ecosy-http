import type { LiteralFunction } from "../types/built-in";
import { toString } from "./string";

/**
 * Checks whether a value is a function (including async and generator functions).
 *
 * @param value - The value to check.
 * @returns `true` if the value is a function.
 *
 * @example
 * ```ts
 * isFunction(() => {}); // true
 * isFunction(async () => {}); // true
 * isFunction(42); // false
 * ```
 */
export function isFunction(value: unknown): value is LiteralFunction {
  return (
    typeof value === "function" ||
    ["[object Function]", "[object AsyncFunction]", "[object GeneratorFunction]"].includes(
      toString(value),
    )
  );
}
