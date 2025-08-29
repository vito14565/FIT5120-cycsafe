// src/pages/IncidentTypeSelect.tsx
import {
  Select,
  MenuItem,
  ListItemIcon,
  ListItemText,
  FormHelperText,
  FormControl,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import CheckIcon from "@mui/icons-material/Check";

/** 標準代碼（寫入 DynamoDB 的值） */
export type IncidentTypeCode =
  | "VEHICLE_COLLISION"
  | "NEAR_MISS"
  | "ROAD_HAZARD"
  | "POOR_INFRA"
  | "AGGRESSIVE_DRIVER"
  | "BIKE_THEFT"
  | "OTHER";

/** 前端顯示用的表（value=代碼、label=描述） */
export const INCIDENT_TYPES: { value: IncidentTypeCode; label: string; color: string }[] = [
  { value: "VEHICLE_COLLISION", label: "Vehicle Collision",      color: "red" },
  { value: "NEAR_MISS",         label: "Near Miss",              color: "orange" },
  { value: "ROAD_HAZARD",       label: "Road Hazard",            color: "gold" },
  { value: "POOR_INFRA",        label: "Poor Infrastructure",    color: "blue" },
  { value: "AGGRESSIVE_DRIVER", label: "Aggressive Driver",      color: "purple" },
  { value: "BIKE_THEFT",        label: "Bike Theft",             color: "gray" },
  { value: "OTHER",             label: "Other",                  color: "darkgray" },
];

/** 依代碼找出對應 label / color（送 API 時可用來補 Incident_type_desc） */
export function getIncidentTypeMeta(code?: IncidentTypeCode | string) {
  return INCIDENT_TYPES.find((t) => t.value === code);
}

interface IncidentTypeSelectProps {
  value: IncidentTypeCode | "";              // 受控 value，空字串代表尚未選
  onChange: (val: IncidentTypeCode) => void; // 回傳代碼
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
}

export default function IncidentTypeSelect({
  value,
  onChange,
  error,
  helperText,
  disabled,
  required,
}: IncidentTypeSelectProps) {
  const handleChange = (e: SelectChangeEvent<IncidentTypeCode | "">) => {
    const v = e.target.value as IncidentTypeCode | "";
    if (v) onChange(v);
  };

  return (
    <FormControl fullWidth error={error} disabled={disabled} required={required}>
      <Select<IncidentTypeCode | "">
        value={value}
        onChange={handleChange}
        displayEmpty
        renderValue={(selected) => {
          if (!selected) return "Select incident type";
          const type = INCIDENT_TYPES.find((t) => t.value === selected);
          return (
            <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <FiberManualRecordIcon style={{ color: type?.color, fontSize: 12 }} />
              {type?.label ?? selected}
            </span>
          );
        }}
      >
        <MenuItem disabled value="">
          <em>Select incident type</em>
        </MenuItem>
        {INCIDENT_TYPES.map((t) => (
          <MenuItem key={t.value} value={t.value}>
            <ListItemIcon>
              <FiberManualRecordIcon style={{ color: t.color, fontSize: 12 }} />
            </ListItemIcon>
            <ListItemText>{t.label}</ListItemText>
            {value === t.value && <CheckIcon fontSize="small" color="action" />}
          </MenuItem>
        ))}
      </Select>
      {error && <FormHelperText>{helperText}</FormHelperText>}
    </FormControl>
  );
}