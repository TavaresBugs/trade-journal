interface PendingRequest {
  controller: AbortController;
  promise: Promise<unknown>;
  users: number;
}

const pending = new Map<string, PendingRequest>();

/** Share only in-flight GETs. Completed financial data is never retained in a global cache. */
export function acquireJson<T>(url: string): { promise: Promise<T>; release: () => void } {
  let request = pending.get(url);
  if (!request) {
    const controller = new AbortController();
    const next: PendingRequest = { controller, users: 0, promise: Promise.resolve() };
    next.promise = fetch(url, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          throw new Error(`Request failed (${response.status})`);
        }
        if (!response.ok) {
          const err = body as { error?: string } | null;
          throw new Error(err?.error ?? `Request failed (${response.status})`);
        }
        return body;
      })
      .finally(() => {
        if (pending.get(url) === next) pending.delete(url);
      });
    request = next;
    pending.set(url, request);
  }
  const shared = request;
  shared.users++;
  let released = false;
  return {
    promise: shared.promise as Promise<T>,
    release: () => {
      if (released) return;
      released = true;
      shared.users--;
      // React Strict Mode can immediately reattach the same subscriber.
      queueMicrotask(() => {
        if (shared.users === 0 && pending.get(url) === shared) {
          pending.delete(url);
          shared.controller.abort();
        }
      });
    },
  };
}
