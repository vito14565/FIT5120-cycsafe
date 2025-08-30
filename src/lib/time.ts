import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

export function timeFromNow(isoOrEpoch?: string | number) {
  if (!isoOrEpoch) return "";
  const d = typeof isoOrEpoch === "number" ? dayjs(isoOrEpoch) : dayjs(isoOrEpoch);
  if (!d.isValid()) return "";
  return d.fromNow(); // e.g., "3 minutes ago"
}