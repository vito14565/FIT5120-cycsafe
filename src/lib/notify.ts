// src/lib/notify.ts
// 本地通知中心：處理風險→(震動/通知/紅點)；完全前端，無使用者輸入

export type Severity = "none" | "medium" | "high";

const BELL_KEY = "cs.bellCount";
const COOLDOWN_KEY = "cs.notify.cooldownUntil";
const COOLDOWN_MS = 90_000; // 90 秒冷卻，避免頻繁提醒

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
  // 廣播給 Header
  window.dispatchEvent(new CustomEvent("cs:bell", { detail: { count: next } }));
}

function vibrate(sev: Severity) {
  if (!("vibrate" in navigator)) return;
  // iOS PWA/Android Chrome 皆可用；pattern 依嚴重度
  if (sev === "high") navigator.vibrate([80, 40, 80, 40, 140]);
  else if (sev === "medium") navigator.vibrate([60, 30, 60]);
}

function sysNotify(title: string, body: string) {
  // 不主動要權限；只有在已授權時顯示
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try { new Notification(title, { body }); } catch {}
  }
}

export function triggerRiskAlert(sev: Severity, message: string) {
  if (sev === "none") return;
  if (inCooldown()) return;

  vibrate(sev);
  bumpBell();
  sysNotify("CycSafe Alert", message);
  startCooldown();
}