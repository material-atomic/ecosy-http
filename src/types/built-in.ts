/* eslint-disable @typescript-eslint/no-explicit-any */

/** JavaScript primitive types (including `null` and `undefined`). */
export type primitive = string | number | boolean | bigint | symbol | undefined | null;

/**
 * Union of all built-in class types that should be treated as opaque values
 * (not recursed into by deep utilities like `Freezable` or `PartialLiteral`).
 */
export type PrimitiveClass =
  | Date
  | RegExp
  | File
  | FileList
  | URL
  | Blob
  | ArrayBuffer
  | SharedArrayBuffer
  | DataView
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
  | BigInt64Array
  | BigUint64Array
  | FormData
  | Headers
  | Request
  | Response
  | URLSearchParams
  | AbortController
  | AbortSignal
  | ReadableStream
  | WritableStream
  | TransformStream
  | Event
  | CustomEvent
  | EventTarget
  | MutationObserver
  | IntersectionObserver
  | ResizeObserver
  | Worker
  | MessageChannel
  | MessagePort
  | BroadcastChannel
  | Generator
  | AsyncGenerator
  | Element
  | HTMLElement
  | Node
  | Document
  | Window
  | Error
  | TypeError
  | RangeError
  | SyntaxError
  | ReferenceError
  | EvalError
  | AggregateError
  | URIError;

/** Union of all primitive values and built-in class instances. */
export type BuiltInPrimitive = primitive | PrimitiveClass;

/** A plain object with string/symbol/number keys and unknown values. */
export type LiteralObject<Keys extends PropertyKey = PropertyKey> =
  | Record<Keys, unknown>
  | { [K in Keys]: unknown }
  | object;

/** A single-key object mapping `Key` to `Value`. */
export type AtomicObject<Key extends PropertyKey = PropertyKey, Value = unknown> = {
  [K in Key]: Value;
};

/** Generic function type with configurable return type and argument tuple. */
export type LiteralFunction<R = unknown, A extends unknown[] = unknown[]> = (...args: A) => R;

/** Any object-like value: plain object, array, or function. */
export type Objectable = LiteralObject | Array<unknown> | LiteralFunction;

/** A value that may be either synchronous or wrapped in a `Promise`. */
export type Promisable<Value> = Value | Promise<Value>;

/** A function with additional static properties (callable object pattern). */
export type ExtendedFunction<F = LiteralFunction, O = LiteralObject> = F & O;

/**
 * Deep-freezes a type by making all properties `readonly` recursively.
 * Preserves functions, built-in classes, and arrays without flattening them.
 */
export type Freezable<T> = T extends primitive
  ? T
  : // 1. Functions: use any[] => any to match all signatures
    T extends (...args: any[]) => any
    ? T
    : // 2. Preserve built-in classes (prevent flattening into plain objects)
      T extends Date | RegExp | Error | Map<any, any> | Set<any>
      ? T
      : // 3. Arrays (including already-readonly arrays)
        T extends ReadonlyArray<infer U>
        ? ReadonlyArray<Freezable<U>>
        : // 4. Plain objects
          T extends object
          ? { readonly [K in keyof T]: Freezable<T[K]> }
          : // Safe fallback
            T;

/**
 * Deep-partial type that correctly handles built-in generics
 * (`Map`, `Set`, `Promise`, `WeakRef`, etc.) and extended functions.
 */
export type PartialLiteral<T> =
  T extends Map<infer K, infer V>
    ? Map<PartialLiteral<K>, PartialLiteral<V>>
    : T extends WeakMap<infer K, infer V>
      ? WeakMap<PartialLiteral<K>, PartialLiteral<V>>
      : T extends ReadonlyMap<infer K, infer V>
        ? ReadonlyMap<PartialLiteral<K>, PartialLiteral<V>>
        : T extends Set<infer U>
          ? Set<PartialLiteral<U>>
          : T extends WeakSet<infer U>
            ? WeakSet<PartialLiteral<U>>
            : T extends ReadonlySet<infer U>
              ? ReadonlySet<PartialLiteral<U>>
              : T extends Promise<infer U>
                ? Promise<PartialLiteral<U>>
                : T extends WeakRef<infer U>
                  ? WeakRef<PartialLiteral<U>>
                  : T extends FinalizationRegistry<infer U>
                    ? FinalizationRegistry<PartialLiteral<U>>
                    : T extends BuiltInPrimitive
                      ? T
                      : T extends ExtendedFunction
                        ? T extends ExtendedFunction<infer F>
                          ? F & {
                              [K in keyof T]?: PartialLiteral<T[K]>;
                            }
                          : T
                        : T extends LiteralObject
                          ? { [K in keyof T]?: PartialLiteral<T[K]> }
                          : T extends Array<infer U>
                            ? Array<PartialLiteral<U>>
                            : T extends ReadonlyArray<infer U>
                              ? ReadonlyArray<PartialLiteral<U>>
                              : T;

/** Converts a value type to its string representation at the type level. */
export type ToString<T> = T extends string | number | bigint | boolean
  ? `${T}`
  : T extends symbol
    ? string
    : T extends null
      ? "null"
      : T extends undefined
        ? "undefined"
        : never;
