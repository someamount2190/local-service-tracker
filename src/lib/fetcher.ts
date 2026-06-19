/**
 * Small resilient HTTP helper: bounded timeout, retry with exponential backoff
 * + jitter, and a typed error that carries the last HTTP status. Used by every
 * network-bound adapter so "the source went down" is handled in exactly one
 * place.
 */

export class FetchError extends Error {
  constructor(
    message: string,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "FetchError";
  }
}

interface FetchJsonOptions {
  timeoutMs?: number;
  retries?: number;
  baseDelayMs?: number;
}

export async function fetchJson<T = unknown>(
  url: string,
  opts: FetchJsonOptions = {},
): Promise<{ data: T; httpStatus: number }> {
  const { timeoutMs = 8000, retries = 2, baseDelayMs = 400 } = opts;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { accept: "application/json" },
        // Always hit the network; we do our own TTL caching in the DB layer.
        cache: "no-store",
      });
      if (!res.ok) {
        // 4xx (other than 429) won't fix themselves — fail fast.
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw new FetchError(`HTTP ${res.status} for ${url}`, res.status);
        }
        throw new FetchError(`HTTP ${res.status} for ${url}`, res.status);
      }
      const data = (await res.json()) as T;
      return { data, httpStatus: res.status };
    } catch (err) {
      lastErr = err;
      const status = err instanceof FetchError ? err.httpStatus : undefined;
      const retriable = status === undefined || status === 429 || status >= 500;
      if (attempt === retries || !retriable) break;
      const delay = baseDelayMs * 2 ** attempt + Math.floor(Math.random() * 200);
      await new Promise((r) => setTimeout(r, delay));
    } finally {
      clearTimeout(timer);
    }
  }

  if (lastErr instanceof FetchError) throw lastErr;
  throw new FetchError(
    lastErr instanceof Error ? lastErr.message : `failed to fetch ${url}`,
  );
}
