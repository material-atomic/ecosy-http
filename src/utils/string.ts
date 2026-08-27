/**
 * Returns the internal `[[Class]]` tag of a value using `Object.prototype.toString`.
 *
 * @example
 * ```ts
 * toString([]); // "[object Array]"
 * toString(null); // "[object Null]"
 * ```
 */
export function toString(value: unknown): string {
  return Object.prototype.toString.call(value);
}

/**
 * Capitalizes the first character of a string.
 *
 * @example
 * ```ts
 * ucfirst("hello"); // "Hello"
 * ```
 */
export function ucfirst<T extends string>(str: T): Capitalize<T> {
  return (str.charAt(0).toUpperCase() + str.slice(1)) as Capitalize<T>;
}

/**
 * Converts a PascalCase or camelCase string to kebab-case.
 * Handles consecutive uppercase characters (e.g. acronyms) gracefully.
 *
 * @example
 * ```ts
 * pascalToKebab("MyComponent");  // "my-component"
 * pascalToKebab("HTMLParser");   // "html-parser"
 * pascalToKebab("camelCase");    // "camel-case"
 * ```
 */
export function pascalToKebab(str: string): string {
  if (!str) return str;

  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}
