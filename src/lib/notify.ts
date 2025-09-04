// src/lib/notify.ts
// Local notification hub: triggers vibration, system notifications, and header bell badge.

/** Alert severity for local UX hooks. */
export type Severity = "none" | "medium" | "high";

const BELL_KEY = "cs.bellCount";
const COOLDOWN_KEY = "cs.notify.cooldownUntil";
const COOLDOWN_MS = 90_000; // 90s cooldown to avoid spamming

function now() { return Date.now(); }

function inCooldown(): boolean {
  const until = Number(localStorage.getItem(COOLDOWN_KEY) || "0");
  return now() < until;
}

function startCooldown() {
  localStorage.setItem(COOLDOWN_KEY, String(now() + COOLDOWN_MS));
}

function bumpBell() {
  const n = Number(localStorage.getItem(BELL_KEY) || "0") || 0;
  const next = n + 1;
  localStorage.setItem(BELL_KEY, String(next));
  // Broadcast to Header
  window.dispatchEvent(new CustomEvent("cs:bell", { detail: { count: next } }));
}

function vibrate(sev: Severity) {
  if (!("vibrate" in navigator)) return;
  // iOS PWA / Android Chrome supported; pattern depends on severity
  if (sev === "high") navigator.vibrate([80, 40, 80, 40, 140]);
  else if (sev === "medium") navigator.vibrate([60, 30, 60]);
}

function sysNotify(title: string, body: string) {
  // Do not proactively request permission; show only when already granted
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try { new Notification(title, { body }); } catch {}
  }
}

/**
 * Trigger a local risk alert with vibration, header bell badge, and optional system notification.
 * Applies a short cooldown to prevent repeated alerts in a short period.
 */
export function triggerRiskAlert(sev: Severity, message: string) {
  if (sev === "none") return;
  if (inCooldown()) return;

  vibrate(sev);
  bumpBell();
  sysNotify("CycSafe Alert", message);
  startCooldown();
}
