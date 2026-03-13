import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

let traceSequence = 0;

function isTraceEnabled() {
  if (typeof window === 'undefined') return false;
  return import.meta.env.DEV || window.localStorage.getItem('bethel-debug') === '1';
}

export function debugLog(scope: string, message: string, payload?: unknown) {
  if (!isTraceEnabled()) return;
  const now = new Date().toISOString();
  if (payload === undefined) {
    console.debug(`[bethel][${now}][${scope}] ${message}`);
    return;
  }
  console.debug(`[bethel][${now}][${scope}] ${message}`, payload);
}

export function startTrace(scope: string, action: string, payload?: unknown) {
  const traceId = `${scope}-${++traceSequence}`;
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  debugLog(scope, `START ${action} (#${traceId})`, payload);

  return {
    success(payload?: unknown) {
      const endedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      debugLog(scope, `SUCCESS ${action} (#${traceId}, ${Math.round(endedAt - startedAt)}ms)`, payload);
    },
    error(error: unknown, payload?: unknown) {
      const endedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      debugLog(scope, `ERROR ${action} (#${traceId}, ${Math.round(endedAt - startedAt)}ms)`, {
        error,
        payload,
      });
    },
  };
}
