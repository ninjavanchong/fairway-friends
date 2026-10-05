// Tiny fetch wrapper + the live-polling hook.
import { useCallback, useEffect, useRef, useState } from "react";

export async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/**
 * Loads a round and keeps it fresh: polls with ?since=<rev> every few seconds
 * (the server answers {unchanged:true} when nothing moved), and pauses while
 * the tab is hidden. `hold()` pauses applying poll results while a local edit
 * is in flight so the screen doesn't flicker back.
 */
export function useRound(code, intervalMs = 3000) {
  const [round, setRound] = useState(null);
  const [error, setError] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const revRef = useRef(0);
  const holds = useRef(0);

  const apply = useCallback(data => {
    if (data?.unchanged) return;
    revRef.current = data.rev;
    setRound(data);
    setError(null);
    setLoadError(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await api(`/rounds/${code}?since=${revRef.current}`);
      if (holds.current === 0) apply(data);
    } catch (e) {
      if (e.status === 404) setError(e.message);
      else setLoadError(e.message || "Could not reach the server");
    }
  }, [code, apply]);

  useEffect(() => {
    revRef.current = 0;
    setRound(null);
    setError(null);
    setLoadError(null);
    refresh();
    const t = setInterval(() => { if (!document.hidden) refresh(); }, intervalMs);
    const vis = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [code, intervalMs, refresh]);

  // Run a write; hold polls until it lands, then apply the fresh round it returns.
  const mutate = useCallback(async fn => {
    holds.current++;
    try {
      const data = await fn();
      if (data?.code) apply(data);
      return data;
    } finally {
      holds.current--;
    }
  }, [apply]);

  return { round, error, loadError, mutate, refresh, setRound };
}
