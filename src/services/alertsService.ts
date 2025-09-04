// src/services/alertsService.ts
// Polls backend cluster alerts, merges with local weather alerts, de-duplicates, and broadcasts updates.

// ===== Types (aligned with AlertTray / Header) =====
export type AlertLite = {
  clusterId: string;
  incidentType: string;
  status?: "pending" | "active";
  reportCount?: number;
  expiresAt: number;                // epoch seconds
  severity?: "low" | "medium" | "high";
  lat?: number;
  lng?: number;
  photoUrls?: string[];
  ackCount?: number;

  // weather/system fields
  description?: string;
  ackable?: boolean;                // set false for weather
};

export type AlertsPayload = {
  ok: boolean;
  serverNow: number;
  alerts: AlertLite[];
};

// Backend "list-alerts" (clusters)
const LIST_URL =
  import.meta.env.VITE_LIST_ALERTS_URL ||
  "https://7wijeaz2y64ixyvovqkhjoysya0lksii.lambda-url.ap-southeast-2.on.aws/";

const REFRESH_MS = 60_000;

let timer: number | undefined;
let inflight: AbortController | null = null;

// Bind a stable handler so we can removeEventListener cleanly
const onMaybeChanged = () => { void fetchOnce(); };
const onWeatherList  = () => { void fetchOnce(); };
const onVisible = () => {
  if (document.visibilityState === "visible") void fetchOnce();
};

export function startAlertsPolling() {
  // ✅ Clear any previous interval/listeners/inflight to avoid aborting this run
  stopAlertsPolling();

  // ✅ Create a fresh polling timer
  timer = window.setInterval(fetchOnce, REFRESH_MS);

  // ✅ Register events to refresh on potential changes and when tab becomes visible
  window.addEventListener("cs:alerts:maybeChanged", onMaybeChanged);
  window.addEventListener("cs:weather:list", onWeatherList);
  window.addEventListener("focus", onVisible);
  document.addEventListener("visibilitychange", onVisible);

  // ✅ Kick off an immediate fetch (will not be aborted by the cleanup above)
  void fetchOnce();
}

export function stopAlertsPolling() {
  if (timer) window.clearInterval(timer);
  timer = undefined;

  window.removeEventListener("cs:alerts:maybeChanged", onMaybeChanged);
  window.removeEventListener("cs:weather:list", onWeatherList);
  window.removeEventListener("focus", onVisible);
  document.removeEventListener("visibilitychange", onVisible);

  if (inflight) {
    inflight.abort();
    inflight = null;
  }
}

async function fetchOnce() {
  try {
    // Cancel any previous in-flight request
    if (inflight) inflight.abort();
    inflight = new AbortController();

    // 1) Backend clusters
    const res = await fetch(LIST_URL, { cache: "no-store", signal: inflight.signal });
    const data: AlertsPayload = await res.json();
    const backend = Array.isArray(data?.alerts) ? data.alerts : [];

    // 2) Local weather (Home.tsx writes to localStorage and dispatches cs:weather:list)
    let weather: AlertLite[] = [];
    try {
      const raw = JSON.parse(localStorage.getItem("cs.weather.alerts") || "[]");
      weather = Array.isArray(raw) ? raw : [];
    } catch {
      weather = [];
    }

    // 3) Merge + filter unexpired + de-duplicate (keep larger expiresAt per clusterId)
    const now = Math.floor(Date.now() / 1000);
    const mergedRaw: AlertLite[] = [...backend, ...weather].filter(
      a => Number(a?.expiresAt || 0) > now
    );

    const byId = new Map<string, AlertLite>();
    for (const a of mergedRaw) {
      const id = String(a?.clusterId || "");
      if (!id) continue;
      const prev = byId.get(id);
      if (!prev) {
        byId.set(id, a);
      } else {
        const keep = Number(a?.expiresAt || 0) >= Number(prev?.expiresAt || 0) ? a : prev;
        byId.set(id, keep);
      }
    }

    const merged = Array.from(byId.values());

    // 4) Sort by remaining time descending (could switch to lastReportAt if available)
    merged.sort((x, y) => Number(y?.expiresAt || 0) - Number(x?.expiresAt || 0));

    // 5) Persist to localStorage + broadcast
    localStorage.setItem("cs.alerts.list", JSON.stringify(merged));
    localStorage.setItem("cs.alerts.total", String(merged.length));
    localStorage.setItem("cs.alerts.updatedAt", String(Date.now()));

    window.dispatchEvent(new CustomEvent("cs:alerts", { detail: { total: merged.length } }));
    window.dispatchEvent(new CustomEvent("cs:alerts:list", { detail: { list: merged } }));
  } catch (e) {
    if ((e as any)?.name === "AbortError") return; // ignore deliberate aborts
    console.error("load alerts failed", e);
  } finally {
    inflight = null;
  }
}
