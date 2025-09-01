// src/pages/ReportIncident.tsx
import "./ReportIncident.css";
import alertIcon from "../assets/alert-red.svg";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import {
  TextField,
  InputAdornment,
  Button,
  FormControl,
  Select,
  MenuItem,
  Box,
  IconButton,
  Tooltip,
  Chip,
  LinearProgress,
  Snackbar,
  Alert,
} from "@mui/material";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import SendIcon from "@mui/icons-material/Send";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import UploadIcon from "@mui/icons-material/CloudUpload";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";

/* MUI DateTimePicker */
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";

/* 相機對話框 */
import CameraCaptureDialog from "../components/CameraCaptureDialog";

/* API */
import { createIncident, getUploadUrl } from "../lib/api";
import type { CreateIncidentPayload } from "../lib/api";

/* ====== Quick Report Helper Function ====== */
export async function submitQuickReport(
  incidentType: string, 
  location: { lat: number; lon: number; address: string }
): Promise<void> {
  // Map incident types to severity levels for quick reports
  const getSeverityFromType = (type: string): SeverityCode => {
    switch (type) {
      case 'collision':
        return 'critical';
      case 'aggressive_driver':
        return 'high';
      case 'near_miss':
        return 'medium';
      case 'road_hazard':
        return 'medium';
      case 'poor_infrastructure':
        return 'low';
      case 'other':
      default:
        return 'medium';
    }
  };

  // Create payload with minimal required data
  const payload: CreateIncidentPayload = {
    Timestamp: new Date().toISOString(),
    Incident_severity: getSeverityFromType(incidentType),
    Incident_description: `Quick report: ${incidentTypes[incidentType as keyof typeof incidentTypes] || incidentType}`,
    Latitude: location.lat,
    Longitude: location.lon,
    LGA: "", // Empty for quick reports
    Verification: "pending",
    Picture: [], // No photos for quick reports
    Incident_type: incidentType,
    Incident_type_desc: incidentTypes[incidentType as keyof typeof incidentTypes] || "Other",
  };

  try {
    await createIncident(payload);
    console.log("✅ Quick report saved to IncidentReporting table");
  } catch (error) {
    console.error("❌ Failed to save quick report:", error);
    throw error; // Re-throw so the UI can handle the error
  }
}

/* ====== 事故類型定義 ====== */
const incidentTypes = {
  "near-miss": "Near Miss",
  "collision": "Collision",
  "road-hazard": "Road Hazard",
  "infrastructure": "Poor Infrastructure",
  "harassment": "Harassment",
  "theft": "Theft/Vandalism",
  "other": "Other"
};

/* ====== 顏色與文字對照表 ====== */
type SeverityCode = "low" | "medium" | "high" | "critical";
const severityColors: Record<SeverityCode, string> = {
  low: "green",
  medium: "orange",
  high: "red",
  critical: "darkred",
};
const severityLabels: Record<SeverityCode, string> = {
  low: "Low - Minor issue",
  medium: "Medium - Concerning",
  high: "High - Dangerous",
  critical: "Critical - Emergency",
};

/* ====== 影像工具：統一轉成 JPEG、必要時縮圖壓縮到 <= 5MB ====== */
const MAX_FILES = 5;
const MAX_MB = 5;
const MAX_DIM = 2000; // 影像最長邊限制，避免過大

async function loadToImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = url;
    });
  } finally {
    // 交給呼叫者決定是否要 revoke；這裡先不 revoke，避免尚未 draw 就釋放
  }
}

async function normalizeToJpeg(file: File, maxDim = MAX_DIM, maxMB = MAX_MB): Promise<File> {
  // 若已符合條件就直接返回
  const okType = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
  const isHeicLike =
    /heic|heif/i.test(file.type) || file.name.toLowerCase().endsWith(".heic") || file.type === "";

  if (okType && !isHeicLike && file.size <= maxMB * 1024 * 1024) {
    const hasExt = /\.[a-z0-9]{2,5}$/i.test(file.name);
    return hasExt ? file : new File([file], `${file.name || "photo"}.jpg`, { type: "image/jpeg" });
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await loadToImage(file);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const scale = Math.min(1, maxDim / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, cw, ch);

    // 先用 0.9，若超過大小再降低一次品質
    let blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.9));
    if (!blob) {
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      const bstr = atob(dataUrl.split(",")[1]);
      const u8 = new Uint8Array(bstr.length);
      for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
      blob = new Blob([u8], { type: "image/jpeg" });
    }
    if (blob.size > maxMB * 1024 * 1024) {
      const blob2 = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.75));
      if (blob2) blob = blob2;
    }

    const base = (file.name || "camera").replace(/\.[a-z0-9]{2,5}$/i, "");
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ====== 主頁面 ====== */
export default function ReportIncident() {
  const [incidentType, setIncidentType] = useState<string>("");
  const [severity, setSeverity] = useState<SeverityCode | "">("");
  const [location, setLocation] = useState("");

  const [dateTime, setDateTime] = useState<Dayjs | null>(dayjs());
  const [description, setDescription] = useState("");

  /* 照片（先上傳 S3 拿 key/URL） */
  const [photos, setPhotos] = useState<File[]>([]);

  /* 目前座標（來自首頁或手動取得） */
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  /* UI 狀態 */
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Snackbar 狀態
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMsg, setSnackMsg] = useState("");
  const [snackSeverity, setSnackSeverity] = useState<"success" | "error">("success");

  const navigate = useNavigate();
  const [camOpen, setCamOpen] = useState(false);

  /* ====== 讀取首頁存的地址/座標，預填 + 同步監聽 ====== */
  useEffect(() => {
    try {
      const savedAddr = localStorage.getItem("cs.address");
      if (savedAddr) setLocation((prev) => (prev ? prev : savedAddr));

      const cs = localStorage.getItem("cs.coords");
      if (cs) {
        const { lat, lon } = JSON.parse(cs);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          setCoords({ lat, lng: lon });
        }
      }
    } catch {
      // ignore
    }

    // 同步監聽（若首頁位置變動）
    const onAddr = (e: Event) => {
      const addr = (e as CustomEvent).detail as string | undefined;
      if (addr) setLocation(addr);
    };
    const onCoords = (e: Event) => {
      const d = (e as CustomEvent).detail as { lat?: number; lon?: number } | undefined;
      if (d?.lat != null && d?.lon != null) setCoords({ lat: d.lat, lng: d.lon });
    };
    window.addEventListener("cs:address", onAddr);
    window.addEventListener("cs:coords", onCoords);
    return () => {
      window.removeEventListener("cs:address", onAddr);
      window.removeEventListener("cs:coords", onCoords);
    };
  }, []);

  /* 上傳處理 */
  const acceptTypes = useMemo(() => ["image/jpeg", "image/png", "image/webp"], []);

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList) return;
      const incoming = Array.from(fileList);
      const prepared: File[] = [];
      const newErrs: Record<string, string> = { ...errors };
      let count = photos.length;

      for (let f of incoming) {
        if (count >= MAX_FILES) break;

        const needConvert =
          !acceptTypes.includes(f.type) ||
          /heic|heif/i.test(f.type) ||
          f.name.toLowerCase().endsWith(".heic") ||
          f.type === "" ||
          f.size > MAX_MB * 1024 * 1024;

        if (needConvert) {
          try {
            f = await normalizeToJpeg(f, MAX_DIM, MAX_MB);
          } catch {
            newErrs.photo = "Failed to process image. Please try another photo.";
            continue;
          }
        }

        if (f.size > MAX_MB * 1024 * 1024) {
          newErrs.photo = `Each photo must be ≤ ${MAX_MB}MB.`;
          continue;
        }
        prepared.push(f);
        count++;
      }

      setErrors(newErrs);
      if (prepared.length) setPhotos((prev) => [...prev, ...prepared]);
    },
    [errors, photos.length, acceptTypes]
  );

  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    await handleFiles(e.dataTransfer.files);
  };

  const onBrowse = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await handleFiles(e.target.files);
    (e.currentTarget as HTMLInputElement).value = "";
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  /* 取得定位（手動覆蓋） */
  const getCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      setGeoError("Your browser does not support geolocation.");
      return;
    }
    setGeoBusy(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        setLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        setGeoBusy(false);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError("Permission denied. You can enable location in your browser settings.");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGeoError("Location unavailable. Please try again later.");
        } else if (err.code === err.TIMEOUT) {
          setGeoError("Location request timed out. Please try again.");
        } else {
          setGeoError(err.message || "Failed to get location.");
        }
        setGeoBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  /* 若沒座標、但使用者填了 "lat, lng" 文字，嘗試解析 */
  const coordsFromFreeText = (): { lat: number; lng: number } | null => {
    const m = location.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (!m) return null;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  };

  /* 驗證 */
  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!incidentType) newErrors.incidentType = "Please select an incident type.";

    if (!location.trim()) newErrors.location = "Location is required.";
    else if (location.trim().length < 5) newErrors.location = "Location must be at least 5 characters.";

    if (!dateTime) newErrors.dateTime = "Date & Time is required.";
    else if (dateTime.isAfter(dayjs())) newErrors.dateTime = "Date & Time cannot be in the future.";

    if (!severity) newErrors.severity = "Please select a severity level.";

    if (!description.trim()) newErrors.description = "Description is required.";
    else if (description.trim().length < 20) newErrors.description = "Description must be at least 20 characters.";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /* 上傳所有照片到 S3，回傳 S3 key/URL 陣列（帶 header 失敗則回退不帶） */
  async function uploadAllPhotos(files: File[]): Promise<string[]> {
    if (files.length === 0) return [];
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const raw of files) {
        // 再保險一次：全部規範化後上傳
        const file = await normalizeToJpeg(raw, MAX_DIM, MAX_MB);
        const { url, key } = await getUploadUrl(file.name, file.type || "image/jpeg");

        // 嘗試 1：帶 Content-Type
        let put = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": file.type || "image/jpeg" },
          body: file,
        });

        // 嘗試 2：有些預簽不允許帶 Content-Type；移除後重試
        if (!put.ok) {
          put = await fetch(url, { method: "PUT", body: file });
        }
        if (!put.ok) throw new Error(`Upload failed: ${file.name} (${put.status})`);

        urls.push(key);
      }
      return urls;
    } finally {
      setUploading(false);
    }
  }

  // 開啟 Snackbar 的小工具
  const openSnack = (msg: string, severity: "success" | "error") => {
    setSnackMsg(msg);
    setSnackSeverity(severity);
    setSnackOpen(true);
  };

  /* 送出 */
  const handleSubmit = async () => {
    if (!validate()) return;

    // 沒有 coords 就嘗試從 location 解析 "lat, lng"
    let finalCoords = coords;
    if (!finalCoords) {
      finalCoords = coordsFromFreeText();
      if (finalCoords) setCoords(finalCoords);
    }

    setSubmitting(true);
    try {
      const pictureKeys = await uploadAllPhotos(photos);

      const payload: CreateIncidentPayload = {
        Timestamp: dateTime!.toDate().toISOString(),
        Incident_severity: severity as SeverityCode,
        Incident_description: description.trim(),
        Latitude: finalCoords?.lat,
        Longitude: finalCoords?.lng,
        LGA: "",
        Verification: "pending",
        Picture: pictureKeys,
        Incident_type: incidentType,
        Incident_type_desc: incidentTypes[incidentType as keyof typeof incidentTypes] || "Other",
      };

      await createIncident(payload);

      // ✅ 成功提示 + 延遲導頁
      openSnack("Report submitted successfully!", "success");
      setTimeout(() => navigate("/"), 1500);

      // reset 表單
      setIncidentType("");
      setSeverity("");
      setLocation("");
      setDateTime(dayjs());
      setDescription("");
      setPhotos([]);
      setCoords(null);
    } catch (err: any) {
      console.error(err);
      openSnack(err?.message || "Failed to submit", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // 相機回傳 File -> 直接規範化後加入列表
  const handleCapturedFile = async (file: File) => {
    try {
      const normalized = await normalizeToJpeg(file, MAX_DIM, MAX_MB);
      setPhotos((prev) => (prev.length >= MAX_FILES ? prev : [...prev, normalized]));
    } catch {
      setErrors((e) => ({ ...e, photo: "Failed to process camera image." }));
    }
  };

  return (
    <main className="report-page">
      <section className="report-card">
        {/* Header */}
        <div className="report-header">
          <img src={alertIcon} alt="Alert" className="report-icon" />
          <h2>Report Safety Incident</h2>
        </div>
        <p className="report-subtitle">
          Help improve cycling safety by reporting incidents in your area. Your report will help other cyclists stay safe.
        </p>

        {/* Incident Type */}
        <label className="form-label">Incident Type *</label>
        <FormControl fullWidth required error={!!errors.incidentType}>
          <Select
            value={incidentType}
            onChange={(e) => setIncidentType(e.target.value)}
            displayEmpty
            sx={{ backgroundColor: "#fff", borderRadius: "6px", "& fieldset": { borderColor: "#ddd" } }}
          >
            <MenuItem value="">
              <em>Select incident type</em>
            </MenuItem>
            {Object.entries(incidentTypes).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </Select>
          {errors.incidentType && <span style={{ color: "red", fontSize: "0.8rem" }}>{errors.incidentType}</span>}
        </FormControl>

        {/* Location */}
        <label className="form-label">Location *</label>
        <TextField
          fullWidth
          required
          placeholder="Enter specific location or intersection"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          error={!!errors.location}
          helperText={errors.location || geoError}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LocationOnIcon style={{ color: "#666" }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title="Use current location">
                  <span>
                    <IconButton size="small" onClick={getCurrentLocation} disabled={geoBusy}>
                      <MyLocationIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </InputAdornment>
            ),
          }}
          sx={{ backgroundColor: "#fff", borderRadius: "6px", "& fieldset": { borderColor: "#ddd" } }}
        />
        {coords && (
          <Box sx={{ mt: 0.5 }}>
            <Chip size="small" label={`Using current location • ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`} variant="outlined" color="primary" />
          </Box>
        )}

        {/* Date & Time */}
        <label className="form-label">Date & Time *</label>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DateTimePicker
            value={dateTime}
            onChange={(v) => setDateTime(v)}
            ampm={false}
            minutesStep={5}
            slotProps={{
              textField: {
                fullWidth: true,
                required: true,
                error: !!errors.dateTime,
                helperText: errors.dateTime,
                sx: { backgroundColor: "#fff", borderRadius: "6px", "& fieldset": { borderColor: "#ddd" } },
              },
            }}
          />
        </LocalizationProvider>

        {/* Severity Level */}
        <label className="form-label">Severity Level *</label>
        <FormControl fullWidth required error={!!errors.severity}>
          <Select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as SeverityCode)}
            displayEmpty
            renderValue={(selected) => {
              if (!selected) return <em style={{ color: "#888" }}>Select severity level</em>;
              const key = selected as SeverityCode;
              return (
                <span style={{ color: severityColors[key], fontWeight: key === "critical" ? "bold" : "normal" }}>
                  {severityLabels[key]}
                </span>
              );
            }}
            sx={{ backgroundColor: "#fff", borderRadius: "6px", "& fieldset": { borderColor: "#ddd" } }}
          >
            <MenuItem value="">
              <em>Select severity level</em>
            </MenuItem>
            <MenuItem value="low" sx={{ color: "green" }}>
              Low - Minor issue
            </MenuItem>
            <MenuItem value="medium" sx={{ color: "orange" }}>
              Medium - Concerning
            </MenuItem>
            <MenuItem value="high" sx={{ color: "red" }}>
              High - Dangerous
            </MenuItem>
            <MenuItem value="critical" sx={{ color: "darkred", fontWeight: "bold" }}>
              Critical - Emergency
            </MenuItem>
          </Select>
          {errors.severity && <span style={{ color: "red", fontSize: "0.8rem" }}>{errors.severity}</span>}
        </FormControl>

        {/* Description */}
        <label className="form-label">Description *</label>
        <TextField
          multiline
          rows={4}
          fullWidth
          required
          placeholder="Please provide details..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={!!errors.description}
          helperText={errors.description}
          sx={{ backgroundColor: "#fff", borderRadius: "6px", "& fieldset": { borderColor: "#ddd" } }}
        />

        {/* Photo Evidence */}
        <label className="form-label" style={{ marginTop: 8 }}>
          Photo Evidence (Optional)
        </label>

        {/* 隱藏 input：Gallery 與 Camera */}
        <input id="gallery-input" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onBrowse} style={{ display: "none" }} />
        <input id="camera-input" type="file" accept="image/*" capture="environment" onChange={onBrowse} style={{ display: "none" }} />

        {/* 上傳卡片 */}
        <Box
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          sx={{
            border: "1.5px solid rgba(0,0,0,0.16)",
            borderRadius: "14px",
            background: "#fafafa",
            p: 2.5,
            textAlign: "center",
            cursor: "pointer",
            transition: "background 0.15s, border-color 0.15s",
            "&:hover": { background: "#f5f5f5", borderColor: "rgba(0,0,0,0.28)" },
          }}
          onClick={() => (document.getElementById("gallery-input") as HTMLInputElement | null)?.click()}
        >
          <PhotoCameraIcon sx={{ fontSize: 28, opacity: 0.6 }} />
          <Box sx={{ mt: 1, fontSize: 16, color: "#4b5563", fontWeight: 600 }}>Tap to upload or take photo</Box>

          <Box sx={{ mt: 1.5, display: "flex", justifyContent: "center", gap: 1 }}>
            <label htmlFor="gallery-input">
              <Button component="span" variant="outlined" startIcon={<UploadIcon />} sx={{ borderRadius: "999px", textTransform: "none", px: 2.2, py: 0.8, fontWeight: 700 }}>
                Gallery
              </Button>
            </label>
            <Button
              type="button"
              variant="outlined"
              startIcon={<PhotoCameraIcon />}
              onClick={() => setCamOpen(true)}
              sx={{ borderRadius: "999px", textTransform: "none", px: 2.2, py: 0.8, fontWeight: 700 }}
            >
              Camera
            </Button>
          </Box>

          <Box sx={{ mt: 1.25, fontSize: 12, color: "#9ca3af" }}>
            JPG/PNG/WEBP • up to {MAX_MB}MB each • max {MAX_FILES} photos
          </Box>
          {errors.photo && <Box sx={{ mt: 1, color: "red", fontSize: 12 }}>{errors.photo}</Box>}
        </Box>

        {/* 縮圖預覽 */}
        {photos.length > 0 && (
          <Box sx={{ mt: 1.5, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 1 }}>
            {photos.map((file, idx) => {
              const url = URL.createObjectURL(file);
              return (
                <Box key={idx} sx={{ position: "relative", border: "1px solid #e0e0e0", borderRadius: "8px", overflow: "hidden", background: "#fff", height: 96 }}>
                  <img
                    src={url}
                    alt={file.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onLoad={() => URL.revokeObjectURL(url)}
                  />
                  <Tooltip title="Remove">
                    <IconButton size="small" onClick={() => removePhoto(idx)} sx={{ position: "absolute", top: 2, right: 2, bgcolor: "rgba(255,255,255,0.9)" }}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              );
            })}
          </Box>
        )}

        {/* 上傳進度 */}
        {(uploading || submitting) && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress />
          </Box>
        )}

        {/* Important Notice */}
        <div className="notice-box">
          <span>⚠️</span>
          <div>
            <strong>Important Notice:</strong>
            <p>
              If this is a medical emergency or active dangerous situation, please call <b>000</b> immediately. This form is for reporting incidents to help improve cycling safety, not for emergency response.
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="form-actions">
          <Button className="submit-btn" startIcon={<SendIcon fontSize="small" />} onClick={handleSubmit} disabled={submitting || uploading}>
            {submitting || uploading ? "Submitting…" : "Submit Report"}
          </Button>
          <Button className="cancel-btn" onClick={() => navigate("/")} disabled={submitting || uploading}>
            Cancel
          </Button>
        </div>
      </section>

      {/* 相機元件 */}
      <CameraCaptureDialog open={camOpen} onClose={() => setCamOpen(false)} onCaptured={handleCapturedFile} />

      {/* Snackbar：成功 / 錯誤提示 */}
      <Snackbar
        open={snackOpen}
        autoHideDuration={2000}
        onClose={() => setSnackOpen(false)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackOpen(false)}
          severity={snackSeverity}
          variant="filled"
          sx={{
            width: "100%",
            fontSize: "1rem",
            fontWeight: "bold",
            textAlign: "center",
            bgcolor: snackSeverity === "success" ? "#1e293b" : "#b91c1c",
            color: "#fff",
          }}
        >
          {snackMsg}
        </Alert>
      </Snackbar>
    </main>
  );
}