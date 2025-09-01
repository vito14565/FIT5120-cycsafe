// src/lib/geo.ts
export function metersToLatDelta(meters: number): number {
  // ~111.32 km per degree latitude
  return meters / 111_320;
}

export function metersToLonDelta(meters: number, atLatDeg: number): number {
  const latRad = (atLatDeg * Math.PI) / 180;
  const metersPerDeg = 111_320 * Math.cos(latRad);
  return meters / metersPerDeg;
}

export function radiusBoundingBox(lat: number, lon: number, meters: number) {
  const dLat = metersToLatDelta(meters);
  const dLon = metersToLonDelta(meters, lat);
  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLon: lon - dLon,
    maxLon: lon + dLon,
  };
}

// Haversine distance in meters
export function haversineMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  const R = 6_371_000; // meters
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;

  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}