// src/lib/crash.ts
const CRASH_COUNT_URL =
  import.meta.env.VITE_CRASH_COUNT_URL ||
  (import.meta.env.VITE_LAMBDA_URL
    ? new URL("crash-count", String(import.meta.env.VITE_LAMBDA_URL)).toString()
    : undefined);

/**
 * Fetch crash count within radius (meters) around lat/lon.
 * Returns 0 if the endpoint is not configured.
 */
export async function fetchCrashCount(
  lat: number,
  lon: number,
  radiusMeters = 500,
  signal?: AbortSignal
): Promise<number> {
  if (!CRASH_COUNT_URL) return 0;

  const url = new URL(CRASH_COUNT_URL);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("radius", String(radiusMeters));
  url.searchParams.set("ts", String(Date.now())); // cache-bust

  const res = await fetch(url.toString(), { cache: "no-store", signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  if (typeof data === "number") return data;
  if (typeof data?.count === "number") return data.count;
  if (Array.isArray(data?.items)) return data.items.length;
  return 0;
}