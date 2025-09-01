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

// crude centroid for polygons; for our UX it's fine
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
  // Use the real API field structure
  const level = String(
    props.status || props.category1 || props.name || props.sourceTitle || ""
  ).toLowerCase();

  const severity = String(props.cap?.severity || "").toLowerCase();
  const urgency = String(props.cap?.urgency || "").toLowerCase();
  
  // Handle emergency warning levels from real VIC data
  if (level.includes("emergency") || level.includes("evacuate") || level.includes("watch and act")) return "CRITICAL";
  if (level.includes("warning") || severity === "severe" || urgency === "immediate") return "HIGH";
  if (level.includes("advice") || level.includes("community information") || severity === "moderate") return "MEDIUM";
  
  // Handle incident status levels
  if (level.includes("responding") || level.includes("request for assistance")) return "HIGH";
  if (level.includes("under control") || level.includes("safe")) return "LOW";
  
  return "MEDIUM"; // Default for unknown status
}

function categoryFromVic(props: Record<string, any>): Category {
  const category1 = String(props.category1 || "").toLowerCase();
  const category2 = String(props.category2 || "").toLowerCase();
  const feedType = String(props.feedType || "").toLowerCase();
  
  // Weather-related incidents
  if (category1.includes("met") || category2.includes("wind") || category2.includes("weather")) return "WEATHER";
  
  // Fire incidents
  if (category1.includes("fire") || category2.includes("fire")) return "SAFETY";
  
  // Tree down and infrastructure
  if (category1.includes("tree") || category2.includes("tree") || category1.includes("other")) return "INFRA";
  
  // Security and rescue
  if (category1.includes("security") || category1.includes("rescue") || category2.includes("security") || category2.includes("rescue")) return "SAFETY";
  
  // Burn areas and environmental
  if (category1.includes("burn") || feedType.includes("burn")) return "SAFETY";
  
  return "SAFETY"; // Default category
}

function cleanDescription(props: Record<string, any>): string {
  // Use the rich text description from real VIC Emergency API
  let description = "";
  
  // First try the clean text field
  if (props.text) {
    description = props.text;
  } 
  // Then try extracting from webBody (remove HTML)
  else if (props.webBody) {
    description = props.webBody
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .trim();
  }
  
  // Fallback descriptions based on category
  if (!description || description.length < 10) {
    const category1 = String(props.category1 || "").toLowerCase();
    const category2 = String(props.category2 || "").toLowerCase();
    const status = String(props.status || "").toLowerCase();
    const location = props.location || "the area";
    
    if (category1.includes("fire")) {
      if (status.includes("safe") || status.includes("under control")) {
        description = `Fire incident at ${location} is now under control. Emergency services have the situation managed.`;
      } else {
        description = `Fire incident reported at ${location}. Emergency services are responding. Avoid the area if possible.`;
      }
    } else if (category1.includes("tree")) {
      description = `Tree down reported at ${location}. Road may be blocked. Use alternative routes where possible.`;
    } else if (category1.includes("rescue")) {
      description = `Emergency services responding to rescue incident at ${location}. Avoid the area to allow emergency vehicles access.`;
    } else if (category1.includes("security")) {
      description = `Security incident reported in ${location}. Follow instructions from emergency services and avoid the area.`;
    } else if (category2.includes("wind")) {
      description = `Strong wind warning in effect for ${location}. Take precautions and secure loose items.`;
    } else {
      description = `Emergency incident reported at ${location}. Stay informed and follow official guidance.`;
    }
  }
  
  // Trim to reasonable length for cards
  if (description.length > 300) {
    description = description.substring(0, 297) + "...";
  }
  
  return description;
}

function pickLocation(props: Record<string, any>, lat?: number, lon?: number) {
  // Use the location field from real VIC Emergency API
  if (props.location) {
    return String(props.location).replace(/^VIC\s*[-,]?\s*/i, '').trim();
  }
  
  // Fallback to other possible location fields
  const candidates = [
    props.locality,
    props.area,
    props.suburb,
    props.region,
    props.municipality
  ].filter(Boolean);

  if (candidates.length > 0) {
    return String(candidates[0]).replace(/^VIC\s*[-,]?\s*/i, '').trim();
  }

  if (lat != null && lon != null) {
    return `${lat.toFixed(3)}°, ${lon.toFixed(3)}°`;
  }
  
  return "Victoria";
}

function extractTitle(props: Record<string, any>): string {
  // Extract meaningful title from real VIC Emergency data
  const webHeadline = props.webHeadline;
  const sourceTitle = props.sourceTitle;
  const name = props.name;
  const category1 = props.category1;
  const category2 = props.category2;
  const action = props.action;
  
  // Build descriptive title
  if (webHeadline) {
    return webHeadline;
  }
  
  if (sourceTitle && action) {
    return `${sourceTitle} - ${action}`;
  }
  
  if (name && category2) {
    return `${category2} ${name}`;
  }
  
  if (category1 && category2) {
    return `${category1} - ${category2}`;
  }
  
  return category1 || category2 || sourceTitle || name || "Emergency Incident";
}

function toAlertFromFeature(f: any): AlertModel | null {
  const p = f?.properties ?? {};
  const [lat, lon] = centroid(f.geometry) ?? [undefined, undefined];

  // Extract title with real API structure
  const title = extractTitle(p);

  // Parse timestamp from real API format
  const timeFields = [p.updated, p.created];
  let when = Date.now();
  
  for (const timeField of timeFields) {
    if (timeField) {
      const parsed = Date.parse(timeField);
      if (parsed && !isNaN(parsed)) {
        when = parsed;
        break;
      }
    }
  }

  const description = cleanDescription(p);
  const priority = priorityFromVic(p);
  const category = categoryFromVic(p);
  const location = pickLocation(p, lat, lon);

  // Create a unique ID using real API fields
  const id = String(
    p.id || 
    p.sourceId || 
    p.eventId ||
    `${title.replace(/\s+/g, '-')}-${when}`
  ).replace(/[^a-zA-Z0-9-_]/g, '');

  // Filter out very old incidents (older than 7 days)
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  if (when < sevenDaysAgo) {
    return null;
  }

  return {
    id,
    title: String(title),
    description: String(description),
    location,
    timestamp: when,
    priority,
    category,
  };
}

async function fetchJson(url: string, signal?: AbortSignal) {
  // Try multiple CORS proxy options
  const proxies = [
    `https://cors-anywhere.herokuapp.com/${url}`,
    `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    `https://thingproxy.freeboard.io/fetch/${url}`,
  ];
  
  for (let i = 0; i < proxies.length; i++) {
    try {
      console.log(`Trying proxy ${i + 1}:`, proxies[i]);
      
      const res = await fetch(proxies[i], { 
        signal,
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      let data;
      if (proxies[i].includes('allorigins.win')) {
        const response = await res.json();
        data = JSON.parse(response.contents);
      } else {
        data = await res.json();
      }
      
      console.log(`✅ Proxy ${i + 1} successful!`);
      return data;
      
    } catch (error) {
      console.warn(`❌ Proxy ${i + 1} failed:`, error);
      if (i === proxies.length - 1) {
        throw new Error(`All proxy attempts failed for ${url}`);
      }
    }
  }
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
  maxMeters = (Number(import.meta.env.VITE_VIC_RADIUS_KM ?? 5) * 1000),
  signal?: AbortSignal,
): Promise<AlertModel[]> {
  // serve warm cache fast
  if (_cache && Date.now() - _cache.at < CACHE_TTL_MS) {
    return _cache.alerts.filter(a => {
      // Still apply distance filtering to cached results
      const alertLoc = a.location;
      if (alertLoc.includes('°')) {
        const [alertLat, alertLon] = alertLoc.split(',').map(s => parseFloat(s.replace('°', '')));
        if (!isNaN(alertLat) && !isNaN(alertLon)) {
          const d = haversineMeters(lat, lon, alertLat, alertLon);
          return d <= maxMeters;
        }
      }
      return true; // Include if we can't determine distance
    });
  }

  try {
    console.log('Fetching VIC Emergency data...');
    
    const [events, impacts] = await Promise.allSettled([
      fetchJson(EVENTS_URL, signal),
      fetchJson(IMPACTS_URL, signal),
    ]);

    const alerts: AlertModel[] = [];

    const pushFromCollection = (col: any, source: string) => {
      const feats: any[] = col?.features || [];
      console.log(`📥 Processing ${feats.length} features from ${source}`);
      
      for (const f of feats) {
        try {
          // Log the raw feature properties for debugging
          console.log(`🔍 Processing feature:`, {
            id: f.properties?.id,
            category1: f.properties?.category1,
            category2: f.properties?.category2,
            status: f.properties?.status,
            location: f.properties?.location,
            hasText: !!f.properties?.text,
            hasWebBody: !!f.properties?.webBody,
            created: f.properties?.created
          });
          
          const a = toAlertFromFeature(f);
          if (!a) {
            console.log(`❌ Feature filtered out (too old or invalid):`, f.properties?.id);
            continue;
          }

          // Log the processed alert
          console.log(`✅ Created alert:`, {
            id: a.id,
            title: a.title,
            category: a.category,
            priority: a.priority,
            location: a.location,
            descriptionLength: a.description.length
          });

          // distance filter (use geometry centroid if available)
          const c = centroid(f.geometry);
          if (c) {
            const d = haversineMeters(lat, lon, c[0], c[1]);
            if (d > maxMeters) {
              console.log(`📍 Alert filtered out by distance: ${(d/1000).toFixed(1)}km away`);
              continue;
            } else {
              console.log(`📍 Alert within range: ${(d/1000).toFixed(1)}km away`);
            }
          } else {
            console.log(`📍 No geometry data - including alert`);
          }
          
          alerts.push(a);
        } catch (error) {
          console.warn('❌ Error processing feature:', error, f.properties?.id);
        }
      }
    };

    if (events.status === "fulfilled") {
      pushFromCollection(events.value, 'events');
    } else {
      console.warn('Events fetch failed:', events.reason);
    }
    
    if (impacts.status === "fulfilled") {
      pushFromCollection(impacts.value, 'impacts');
    } else {
      console.warn('Impacts fetch failed:', impacts.reason);
    }

    console.log(`Found ${alerts.length} alerts within ${maxMeters/1000}km`);

    // sort by Priority desc then time desc
    const weight: Record<Priority, number> = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };
    alerts.sort((a, b) => {
      const w = weight[b.priority] - weight[a.priority];
      return w !== 0 ? w : b.timestamp - a.timestamp;
    });

    _cache = { at: Date.now(), alerts };
    
    // Apply distance filtering for this specific request
    return alerts.filter(a => {
      const alertLoc = a.location;
      if (alertLoc.includes('°')) {
        const [alertLat, alertLon] = alertLoc.split(',').map(s => parseFloat(s.replace('°', '')));
        if (!isNaN(alertLat) && !isNaN(alertLon)) {
          const d = haversineMeters(lat, lon, alertLat, alertLon);
          return d <= maxMeters;
        }
      }
      return true;
    });
    
  } catch (error) {
    console.error('VIC Emergency fetch failed:', error);
    // silent fail → empty list
    return [];
  }
}

// Helper function to clear cache (useful for testing)
export function clearVicCache() {
  _cache = null;
}