import type { LiteralObject, Objectable } from "../types/built-in";
import { isFunction } from "./is-function";

/**
 * Checks whether a value is a non-null object.
 *
 * @param value - The value to check.
 * @returns `true` if the value is of type `object` and is not `null`.
 */
export function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

/**
 * Checks whether a value is a plain object (created by `{}` or `Object.create(null)`).
 *
 * @param value - The value to check.
 * @returns `true` if the value is a plain literal object.
 */
export function isLiteralObject(value: unknown): value is LiteralObject {
  if (!isObject(value) || Array.isArray(value)) {
    return false;
  }

  const proto = Object.getPrototypeOf(value);

  return proto === null || proto === Object.prototype;
}

/**
 * Checks whether a value is a complex (non-array) object, such as a class instance.
 *
 * @param value - The value to check.
 * @returns `true` if the value is a non-array object.
 */
export function isComplexObject<Target extends LiteralObject>(value: unknown): value is Target {
  return isObject(value) && !Array.isArray(value);
}

/**
 * Checks whether a value is an object, array, or function.
 *
 * @param value - The value to check.
 * @returns `true` if the value is "objectable" (object, array, or function).
 */
export function isObjectable(value: unknown): value is Objectable {
  return isObject(value) || isFunction(value);
}

/**
 * Type-safe check for own property existence on an object.
 *
 * @param obj - The object to check.
 * @param key - The property key to look for.
 * @returns `true` if the object has the specified own property.
 *
 * @example
 * ```ts
 * hasOwnProperty({ a: 1 }, "a"); // true
 * hasOwnProperty({ a: 1 }, "b"); // false
 * ```
 */
export function hasOwnProperty<Obj, Key extends PropertyKey, As = unknown>(
  obj: Obj,
  key: Key,
): obj is Obj & Record<Key, As> {
  if (!obj) {
    return false;
  }

  if (!isObjectable(obj)) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  return (
    Object.prototype.hasOwnProperty.call(obj, key) || key in (obj as Record<PropertyKey, unknown>)
  );
}
