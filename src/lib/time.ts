import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

/**
 * Return a humanized relative time string (e.g., "3 minutes ago").
 * Accepts an ISO string or epoch milliseconds. Returns empty string on invalid input.
 */
export function timeFromNow(isoOrEpoch?: string | number) {
  if (!isoOrEpoch) return "";
  const d = typeof isoOrEpoch === "number" ? dayjs(isoOrEpoch) : dayjs(isoOrEpoch);
  if (!d.isValid()) return "";
  return d.fromNow(); // e.g., "3 minutes ago"
}
