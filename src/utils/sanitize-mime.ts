/** RFC 2045 MIME type pattern: `type/subtype` with optional `;parameter=value`. */
export const MIME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_.+]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_.+]*(;\s*[\w.-]+=[\w.-]+)*$/;

/**
 * Validate and sanitize a MIME type string.
 *
 * Returns the input unchanged if valid, empty string if malformed.
 * This prevents attackers from smuggling values like `application/php/jpeg`
 * through to the upstream API — the empty Content-Type lets the API
 * server reject the payload on its own terms instead of crashing ours.
 */
export function sanitizeMime(value: string): string {
  return MIME_REGEX.test(value) ? value : "";
}
