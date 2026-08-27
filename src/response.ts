/** Normalized response returned by all `Http` methods. */
export interface HttpResponse<T = unknown, E = unknown> {
  success: boolean;
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  error: E | null;
}
