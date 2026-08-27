import type { Freezable, LiteralObject } from "../types/built-in";
import { clone } from "./clone";
import { isObject } from "./object";

function deepFreezeInternal<T extends LiteralObject>(obj: T): T {
  const propNames = Reflect.ownKeys(obj);

  for (const name of propNames) {
    const value = obj[name as keyof T];
    if (isObject(value)) {
      deepFreezeInternal(value);
    }
  }

  return Object.freeze(obj);
}

/**
 * Deep freezes a value by first cloning it, then recursively calling `Object.freeze`.
 * Primitives are returned as-is.
 *
 * @param data - The value to freeze.
 * @param cloneDeep - Custom clone function (defaults to `clone`).
 * @returns A deeply frozen copy of the input.
 *
 * @example
 * ```ts
 * const frozen = freeze({ a: { b: 1 } });
 * frozen.a.b = 2; // throws in strict mode
 * ```
 */
export function freeze<DataType>(data: DataType, cloneDeep = clone): Freezable<DataType> {
  if (!isObject(data)) {
    return data as Freezable<DataType>;
  }

  const cloned = cloneDeep(data);

  return deepFreezeInternal(cloned) as Freezable<DataType>;
}
