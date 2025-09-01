// src/services/vicEmergency.ts
import type { Priority, Category } from "../components/AlertItem";

// Keep the same shape your AlertsPage expects
export type AlertModel = {
  id: string;
  title: string;
  description: string;
  location: string;
  timestamp: number; // ms
  priority: Priority;
  category: Category;
};

const EVENTS_URL = "https://emergency.vic.gov.au/public/events-geojson.json";
const IMPACTS_URL = "https://emergency.vic.gov.au/public/impact-areas-geojson.json";

const CACHE_TTL_MS = 120_000; // 2 minutes
let _cache: { at: number; alerts: AlertModel[] } | null = null;

// ~~~ helpers ~~~
function toRad(v: number) { return (v * Math.PI) / 180; }
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// crude centroid for polygons; for our UX it’s fine
function centroid(geom: any): [number, number] | null {
  if (!geom) return null;
  const t = geom.type;
  if (t === "Point" && Array.isArray(geom.coordinates)) {
    const [lon, lat] = geom.coordinates;
    return [lat, lon];
  }
  const coords =
    t === "Polygon" ? geom.coordinates?.[0] :
    t === "MultiPolygon" ? geom.coordinates?.[0]?.[0] : null;
  if (!coords || !Array.isArray(coords)) return null;
  let sx = 0, sy = 0, n = 0;
  for (const [lon, lat] of coords) { sx += lat; sy += lon; n++; }
  if (!n) return null;
  return [sx / n, sy / n];
}

function priorityFromVic(props: Record<string, any>): Priority {
  const level = String(
    props.warningLevel || props.alertLevel || props.status || props.category2 || ""
  ).toLowerCase();

  if (level.includes("emergency")) return "CRITICAL";
  if (level.includes("watch") || level.includes("act")) return "HIGH";
  if (level.includes("advice")) return "MEDIUM";

  // some events use numeric or other wording
  const sev = String(props.severity || props.priority || "").toLowerCase();
  if (/high|severe|major/.test(sev))   return "HIGH";
  if (/medium|mod(erate)?/.test(sev))  return "MEDIUM";
  return "LOW";
}

function categoryFromVic(props: Record<string, any>): Category {
  const s = (
    props.category ||
    props.category1 ||
    props.eventCategory ||
    props.type ||
    props.hazard ||
    ""
  ).toString().toLowerCase();

  if (/flood|storm|weather|wind|rain|thunder|hail|heat|cold/.test(s)) return "WEATHER";
  if (/traffic|road|incident|crash|collision/.test(s))                 return "TRAFFIC";
  if (/works|maintenance|infrastructure|closure/.test(s))              return "INFRA";
  if (/fire|bushfire|hazmat|health|public|emergency/.test(s))          return "SAFETY";
  return "SAFETY";
}

function pickLocation(props: Record<string, any>, lat?: number, lon?: number) {
  const cand =
    props.location || props.locality || props.area || props.near ||
    props.municipality || props.lga || "";
  if (cand) return String(cand);
  if (lat != null && lon != null) return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  return "Victoria";
}

function toAlertFromFeature(f: any): AlertModel | null {
  const p = f?.properties ?? {};
  const [lat, lon] = centroid(f.geometry) ?? [undefined, undefined];

  const title =
    p.headline || p.title || p.name || p.eventName || p.summary || "Incident";
  const when =
    Date.parse(p.updated || p.published || p.sent || p.created || "") || Date.now();

  const descParts = [
    p.description || p.message || p.instruction || p.advice || p.longDescription,
  ].filter(Boolean);
  const description = descParts.join(" ");

  const priority = priorityFromVic(p);
  const category = categoryFromVic(p);
  const location = pickLocation(p, lat, lon);

  return {
    id: String(f.id || p.id || `${title}#${when}`),
    title: String(title),
    description: String(description || "Stay informed and follow official guidance."),
    location,
    timestamp: when,
    priority,
    category,
  };
}

async function fetchJson(url: string, signal?: AbortSignal) {
  const res = await fetch(url, { cache: "no-store", signal });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

/**
 * Fetch VIC Emergency feeds, convert to AlertModel[], filter by distance.
 * @param lat center latitude
 * @param lon center longitude
 * @param maxMeters include items within this distance (default 25km)
 */
export async function fetchVicAlertsNearby(
  lat: number,
  lon: number,
  maxMeters = (Number(import.meta.env.VITE_VIC_RADIUS_KM ?? 25) * 1000),
  signal?: AbortSignal,
): Promise<AlertModel[]> {
  // serve warm cache fast
  if (_cache && Date.now() - _cache.at < CACHE_TTL_MS) {
    return _cache.alerts.filter(a => !!a);
  }

  try {
    const [events, impacts] = await Promise.allSettled([
      fetchJson(EVENTS_URL, signal),
      fetchJson(IMPACTS_URL, signal),
    ]);

    const alerts: AlertModel[] = [];

    const pushFromCollection = (col: any) => {
      const feats: any[] = col?.features || [];
      for (const f of feats) {
        const a = toAlertFromFeature(f);
        if (!a) continue;

        // distance filter (use geometry centroid if available)
        const c = centroid(f.geometry);
        if (c) {
          const d = haversineMeters(lat, lon, c[0], c[1]);
          if (d > maxMeters) continue;
        }
        alerts.push(a);
      }
    };

    if (events.status === "fulfilled") pushFromCollection(events.value);
    if (impacts.status === "fulfilled") pushFromCollection(impacts.value);

    // sort by Priority desc then time desc
    const weight: Record<Priority, number> = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };
    alerts.sort((a, b) => {
      const w = weight[b.priority] - weight[a.priority];
      return w !== 0 ? w : b.timestamp - a.timestamp;
    });

    _cache = { at: Date.now(), alerts };
    return alerts;
  } catch {
    // silent fail → empty list
    return [];
  }
}