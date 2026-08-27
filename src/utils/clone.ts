import { isFunction } from "./is-function";
import { hasOwnProperty, isObjectable } from "./object";

type CloneStratery = (data: unknown, cache: WeakMap<object, unknown>) => unknown;

type BufferLike = {
  buffer: ArrayBuffer;
  byteOffset: number;
  byteLength: number;
};
type BufferClass = new (buffer: ArrayBuffer, byteOffset?: number, length?: number) => BufferLike;

const cloneStrateries = {
  [Date.toString()]: (data: Date) => new Date(data.getTime()),
  [RegExp.toString()]: (data: RegExp) => new RegExp(data.source, data.flags),
  [Map.toString()]: (data: Map<unknown, unknown>, cache: WeakMap<object, unknown>) => {
    const result = new Map();
    cache.set(data, result);
    data.forEach((val, key) => {
      result.set(clone(key, cache), clone(val, cache));
    });
    return result;
  },
  [Set.toString()]: (data: Set<unknown>, cache: WeakMap<object, unknown>) => {
    const result = new Set();
    cache.set(data, result);
    data.forEach((val) => {
      result.add(clone(val, cache));
    });
    return result;
  },
  [ArrayBuffer.toString()]: (data: ArrayBuffer) => {
    return data.slice(0);
  },
};

const Strateries = [Date, RegExp, Map, Set, ArrayBuffer];

const NumberTypedArray = [
  Int8Array,
  Uint8Array,
  Uint8ClampedArray,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array,
  BigInt64Array,
  BigUint64Array,
  DataView,
];

const DoNotClone = (() => {
  return Array.from(
    new Set([
      // Built-in
      Error,
      Promise,
      Blob,
      // Split by environment
      typeof WeakMap !== "undefined" && WeakMap,
      typeof WeakSet !== "undefined" && WeakSet,
      typeof Symbol !== "undefined" && Symbol,
      typeof Window !== "undefined" && Window,
      typeof File !== "undefined" && File,
      typeof FormData !== "undefined" && FormData,
      typeof Headers !== "undefined" && Headers,
      typeof Request !== "undefined" && Request,
      typeof Response !== "undefined" && Response,
      typeof Worker !== "undefined" && Worker,
      typeof AbortController !== "undefined" && AbortController,
      typeof Node !== "undefined" && Node,
      typeof FileList !== "undefined" && FileList,
    ]),
  );
})();

function isConstructor<Targets extends unknown[]>(
  constructor: unknown,
  targets: Targets,
): constructor is Targets[number] {
  return targets.includes(constructor);
}

/**
 * Deep clones a value, handling circular references, built-in types (Date, RegExp, Map, Set,
 * ArrayBuffer, TypedArrays), arrays, and plain objects. Skips non-cloneable types like
 * Error, Promise, WeakMap, DOM nodes, etc.
 *
 * @param data - The value to clone.
 * @param cache - Internal WeakMap used to track circular references.
 * @returns A deep copy of the input value.
 *
 * @example
 * ```ts
 * const original = { a: 1, b: { c: 2 } };
 * const cloned = clone(original);
 * cloned.b.c = 3;
 * original.b.c; // still 2
 * ```
 */
export function clone<DataType>(data: DataType, cache = new WeakMap<object, unknown>()): DataType {
  if (
    !isObjectable(data) ||
    isFunction(data) ||
    hasOwnProperty(data, "$$typeof") ||
    (data.constructor && isConstructor(data.constructor, DoNotClone))
  ) {
    return data;
  }

  // Prevent circular references
  if (cache.has(data)) {
    return cache.get(data) as DataType;
  }

  if (data.constructor && isConstructor(data.constructor, NumberTypedArray)) {
    const itemData = data as unknown as BufferLike;
    const ItemClass = data.constructor as BufferClass;
    const result = new ItemClass(
      itemData.buffer.slice(0),
      itemData.byteOffset,
      itemData.byteLength,
    ) as DataType;
    cache.set(data, result);
    return result;
  }

  const ItemConstructor = data.constructor as (typeof Strateries)[number];

  if (Strateries.includes(ItemConstructor)) {
    const handleName = ItemConstructor.toString() as keyof typeof cloneStrateries;
    const handler = cloneStrateries[handleName] as CloneStratery;
    const result = handler(data as unknown, cache) as DataType;
    cache.set(data, result);
    return result;
  }

  // Is Object | Array | Class | Instance | Function
  const result = Array.isArray(data)
    ? new ((Object.getPrototypeOf(data)?.constructor as ArrayConstructor) || Array)()
    : Object.create(Object.getPrototypeOf(data));
  cache.set(data, result);

  const keys = Reflect.ownKeys(data);

  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(data, key);

    if (descriptor) {
      if ("value" in descriptor) {
        descriptor.value = clone(descriptor.value, cache);
      }

      Object.defineProperty(result, key, descriptor);
    }
  }

  return result;
}
