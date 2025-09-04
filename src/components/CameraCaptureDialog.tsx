import React, { useEffect, useRef, useState, useCallback } from "react";
import { Dialog, DialogContent, Box, Button } from "@mui/material";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";

export type CameraCaptureDialogProps = {
  /** Whether the camera dialog is open */
  open: boolean;
  /** Close the dialog (may or may not capture) */
  onClose: () => void;
  /** Callback when a photo is captured */
  onCaptured: (file: File) => void;
  /**
   * Add more props if you want to customize copy or titles.
   * Not currently used.
   */
};

export default function CameraCaptureDialog({
  open,
  onClose,
  onCaptured,
}: CameraCaptureDialogProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [camReady, setCamReady] = useState(false);
  const [loadingCam, setLoadingCam] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);

  // ---- utils ----
  const resetVideoEl = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    try { v.pause(); } catch {}
    // @ts-ignore
    v.srcObject = null;
    v.removeAttribute("src");
    v.load();
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try { t.stop(); } catch {}
      });
      streamRef.current = null;
    }
    resetVideoEl();
    setCamReady(false);
  }, [resetVideoEl]);

  async function getFrontStream(): Promise<MediaStream> {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "user" } },
        audio: false,
      });
    } catch (e) {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const vids = devices.filter((d) => d.kind === "videoinput");
      let front = vids.find((d) => /front|integrated|webcam|內建|內置|face/i.test(d.label));
      if (!front && vids.length) front = vids[0];
      if (front?.deviceId) {
        return await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: front.deviceId } },
          audio: false,
        });
      }
      throw e;
    }
  }

  async function initCamera() {
    if (!open) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError("This browser does not support camera access.");
      return;
    }
    setCamError(null);
    setLoadingCam(true);
    setCamReady(false);
    resetVideoEl();
    stopStream();

    try {
      let stream: MediaStream | null = null;
      try {
        stream = await getFrontStream();
      } catch (err: any) {
        if (err?.name === "NotReadableError") {
          await new Promise((r) => setTimeout(r, 300));
          stream = await getFrontStream();
        } else {
          throw err;
        }
      }
      streamRef.current = stream!;
      const v = videoRef.current!;
      v.muted = true;
      v.playsInline = true;
      // @ts-ignore
      v.srcObject = streamRef.current;

      await new Promise<void>((res) => {
        const onMeta = () => {
          v.removeEventListener("loadedmetadata", onMeta);
          res();
        };
        v.addEventListener("loadedmetadata", onMeta);
      });

      try {
        await v.play();
      } catch {
        // Some browsers require user interaction; UI is already in a dialog
      }
      setCamReady(true);
    } catch (e: any) {
      setCamError(e?.message || "Failed to access camera.");
      setCamReady(false);
    } finally {
      setLoadingCam(false);
    }
  }

  async function takePhotoAndEmit() {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    const w = v.videoWidth || 1280;
    const h = v.videoHeight || 720;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, w, h);

    const blob: Blob = await new Promise((res) =>
      canvas.toBlob((b) => res(b!), "image/jpeg", 0.92)
    );
    const file = new File([blob], `camera_${Date.now()}.jpg`, { type: "image/jpeg" });
    onCaptured(file);
    onClose();
  }

  // Initialize when opened; release camera when closed/unmounted
  useEffect(() => {
    if (open) {
      initCamera();
    } else {
      stopStream();
    }
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      TransitionProps={{ onExited: stopStream }}
      keepMounted={false}
      fullWidth
      maxWidth="xs"
    >
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ position: "relative", background: "#000" }}>
          <video
            ref={videoRef}
            playsInline
            style={{ width: "100%", height: "auto", background: "#000" }}
          />
          {!camReady && !camError && (
            <Box sx={{ p: 2, color: "#fff", fontSize: 14, textAlign: "center" }}>
              {loadingCam ? "Initializing camera…" : "Waiting for camera…"}
            </Box>
          )}
          {camError && (
            <Box sx={{ p: 2, color: "red", fontSize: 14, textAlign: "center" }}>
              {camError}
            </Box>
          )}
          <Box sx={{ display: "flex", gap: 1, p: 1.5, justifyContent: "space-between" }}>
            <Button onClick={onClose} variant="text">Close</Button>
            <Button
              onClick={takePhotoAndEmit}
              variant="contained"
              startIcon={<PhotoCameraIcon />}
              disabled={!camReady}
            >
              {camReady ? "Take photo" : "Waiting…"}
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
