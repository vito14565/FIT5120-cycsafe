// src/incidentTypes.ts

/** 標準代碼（寫入 DynamoDB 的值） */
export type IncidentTypeCode =
  | "COLLISION"
  | "NEAR MISS"
  | "ROAD HAZARD"
  | "POOR INFRASTRUCTURE"
  | "AGGRESSIVE DRIVER"
  | "THEFT/VANDALISM"
  | "HARASSMENT"
  | "OTHER";

/** 代碼 → 前端顯示用 label / color */
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

/** 根據代碼找 meta 資訊 */
export function findIncidentType(code?: string) {
  return INCIDENT_TYPES.find((t) => t.code === code);
}

/** 只取 label（常用於 DynamoDB 寫入 Incident_type_desc） */
export function getIncidentTypeLabel(code?: string): string {
  return findIncidentType(code)?.label ?? "Other";
}