// src/incidentTypes.ts

/** 標準代碼（寫入 DynamoDB 的值） */
export type IncidentTypeCode =
  | "VEHICLE_COLLISION"
  | "NEAR_MISS"
  | "ROAD_HAZARD"
  | "POOR_INFRA"
  | "AGGRESSIVE_DRIVER"
  | "BIKE_THEFT"
  | "OTHER";

/** 代碼 → 前端顯示用 label / color */
export const INCIDENT_TYPES: {
  code: IncidentTypeCode;
  label: string;
  color: string;
}[] = [
  { code: "VEHICLE_COLLISION", label: "Vehicle Collision",      color: "red" },
  { code: "NEAR_MISS",         label: "Near Miss",              color: "orange" },
  { code: "ROAD_HAZARD",       label: "Road Hazard",            color: "gold" },
  { code: "POOR_INFRA",        label: "Poor Infrastructure",    color: "blue" },
  { code: "AGGRESSIVE_DRIVER", label: "Aggressive Driver",      color: "purple" },
  { code: "BIKE_THEFT",        label: "Bike Theft",             color: "gray" },
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