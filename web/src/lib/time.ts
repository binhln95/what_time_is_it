// Client-side time helpers (Intl API only).

export const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

const supported = Intl.supportedValuesOf("timeZone")
export const allTimeZones = supported.includes("UTC")
  ? supported
  : ["UTC", ...supported]

// "Asia/Ho_Chi_Minh" -> "Ho Chi Minh"
export const cityName = (tz: string) => tz.split("/").pop()!.replace(/_/g, " ")

export function formatTime(ms: number, timeZone: string, withSeconds = false) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
  }).format(ms)
}

export function formatDate(ms: number, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(ms)
}

export function formatLongDate(ms: number, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    dateStyle: "full",
  }).format(ms)
}

// UTC offset in minutes of `timeZone` at instant `ms` ("GMT+05:30" -> 330).
export function offsetMinutes(ms: number, timeZone: string) {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
      .formatToParts(ms)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT"
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(name)
  if (!m) return 0
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]))
}

// 330 -> "UTC+05:30"
export function formatOffset(minutes: number) {
  const sign = minutes < 0 ? "-" : "+"
  const abs = Math.abs(minutes)
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`
}

// Difference to the browser's timezone, e.g. "+2h", "-5h 30m", "Same time".
export function relativeToLocal(ms: number, timeZone: string) {
  const diff = offsetMinutes(ms, timeZone) - offsetMinutes(ms, browserTimeZone)
  if (diff === 0) return "Same time"
  const abs = Math.abs(diff)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${diff > 0 ? "+" : "-"}${h ? `${h}h` : ""}${h && m ? " " : ""}${m ? `${m}m` : ""}`
}

// Wall-clock "YYYY-MM-DDTHH:mm" in `timeZone` -> UTC epoch ms (same algorithm as the backend).
export function zonedLocalToUtc(
  local: string,
  timeZone: string
): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local)
  if (!m) return null
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])
  let utc = asUtc - offsetMinutes(asUtc, timeZone) * 60_000
  utc = asUtc - offsetMinutes(utc, timeZone) * 60_000
  return utc
}
