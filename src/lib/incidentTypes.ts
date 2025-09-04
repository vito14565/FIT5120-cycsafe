// src/incidentTypes.ts

/** Standard codes (values written to the database) */
export type IncidentTypeCode =
  | "COLLISION"
  | "NEAR MISS"
  | "ROAD HAZARD"
  | "POOR INFRASTRUCTURE"
  | "AGGRESSIVE DRIVER"
  | "THEFT/VANDALISM"
  | "HARASSMENT"
  | "OTHER";

/** Code → UI label and color */
export const INCIDENT_TYPES: {
  code: IncidentTypeCode;
  label: string;
  color: string;
}[] = [
  { code: "COLLISION", label: "Vehicle Collision",      color: "red" },
  { code: "NEAR MISS",         label: "Near Miss",              color: "orange" },
  { code: "ROAD HAZARD",       label: "Road Hazard",            color: "gold" },
  { code: "POOR INFRASTRUCTURE",        label: "Poor Infrastructure",    color: "blue" },
  { code: "AGGRESSIVE DRIVER", label: "Aggressive Driver",      color: "purple" },
  { code: "THEFT/VANDALISM",        label: "Theft/Vandalism",             color: "gray" },
  { code: "HARASSMENT",             label: "Harassment",                  color: "darkgray" },
  { code: "OTHER",             label: "Other",                  color: "darkgray" },
];

/** Find type metadata by code */
export function findIncidentType(code?: string) {
  return INCIDENT_TYPES.find((t) => t.code === code);
}

/** Return the label only (useful for Incident_type_desc) */
export function getIncidentTypeLabel(code?: string): string {
  return findIncidentType(code)?.label ?? "Other";
}
