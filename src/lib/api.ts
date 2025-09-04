// src/lib/api.ts

/**
 * Payload for creating an incident via the backend Lambda.
 */
export type CreateIncidentPayload = {
  Timestamp: string;
  Incident_severity: "low" | "medium" | "high" | "critical";
  Incident_description: string;
  Latitude?: number;
  Longitude?: number;
  LGA?: string;
  Verification?: "pending" | "verified" | "rejected";
  /** S3 object keys or public URLs */
  Picture?: string[];
  /** Incident type code, e.g. "ROAD_HAZARD" */
  Incident_type: string;
  /** Human‑readable incident type description */
  Incident_type_desc?: string;
  /** Optional contact details (email or phone) */
  Contact?: string;
};

// Read from .env via Vite
const CREATE_URL = import.meta.env.VITE_API_CREATE_INCIDENT as string | undefined;
const UPLOAD_URL = import.meta.env.VITE_API_UPLOAD_IMAGE as string | undefined;
const BUCKET     = import.meta.env.VITE_UPLOAD_BUCKET as string | undefined;
const PREFIX     = import.meta.env.VITE_UPLOAD_PREFIX as string | undefined;

/**
 * Create an incident (calls the createIncident Lambda).
 * Throws if the request fails or the backend returns an error.
 */
export async function createIncident(payload: CreateIncidentPayload) {
  if (!CREATE_URL) throw new Error("Missing VITE_API_CREATE_INCIDENT");

  const res = await fetch(CREATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.message || "Failed to create incident");
  }
  return data as { ok: true; INCIDENT_NO: string; Timestamp: string };
}

/**
 * Request a pre‑signed S3 upload URL from the backend.
 * Returns the signed PUT URL and the resulting object key.
 */
export async function getUploadUrl(filename: string, contentType: string) {
  if (!UPLOAD_URL) throw new Error("Missing VITE_API_UPLOAD_IMAGE");

  const res = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename,
      contentType,
      bucket: BUCKET,
      prefix: PREFIX,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.url || !data?.key) {
    throw new Error(data?.message || "Failed to get upload URL");
  }

  // Example: { ok:true, url: <signed PUT url>, key: "incidents/2025/0827/xxx.jpg" }
  return data as { ok: true; url: string; key: string };
}
