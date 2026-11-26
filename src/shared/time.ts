// Pure time helpers (no AWS deps) - shared by all functions and unit-tested.

import tzlookup from '@photostructure/tz-lookup';

// Coordinates -> IANA timezone, using an offline timezone-boundary map bundled into the
// Lambda (no external API). Returns null for out-of-range / non-numeric coordinates.
// Over oceans it returns nautical zones such as "Etc/GMT-8".
export function timeZoneAt(lat: number, lon: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  try {
    const tz = tzlookup(lat, lon);
    return isValidTimeZone(tz) ? tz : null;
  } catch {
    return null;
  }
}

export interface TimeInfo {
  timezone: string;
  datetime: string;
  date: string;
  time: string;
  dayOfWeek: string;
  utcOffset: string;
  utcDatetime: string;
  unixTime: number;
}

export function isValidTimeZone(tz: unknown): tz is string {
  if (!tz || typeof tz !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Build time info for a given Date and IANA timezone.
export function getTimeInfo(date: Date, timeZone: string): TimeInfo {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'long',
      hourCycle: 'h23',
      timeZoneName: 'longOffset',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  ) as Partial<Record<Intl.DateTimeFormatPartTypes, string>>;

  // "GMT+07:00" -> "+07:00", "GMT" -> "+00:00"
  const tzName = parts.timeZoneName ?? 'GMT';
  const utcOffset = tzName === 'GMT' ? '+00:00' : tzName.replace('GMT', '');
  const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
  const localDate = `${parts.year}-${parts.month}-${parts.day}`;
  const localTime = `${parts.hour}:${parts.minute}:${parts.second}`;

  return {
    timezone: timeZone,
    datetime: `${localDate}T${localTime}.${ms}${utcOffset}`,
    date: localDate,
    time: localTime,
    dayOfWeek: parts.weekday ?? '',
    utcOffset,
    utcDatetime: date.toISOString(),
    unixTime: Math.floor(date.getTime() / 1000),
  };
}

// UTC offset of `timeZone` at instant `date`, in minutes ("+07:00" -> 420).
export function offsetMinutes(date: Date, timeZone: string): number {
  const offset = getTimeInfo(date, timeZone).utcOffset;
  const sign = offset.startsWith('-') ? -1 : 1;
  const [h, m] = offset.slice(1).split(':').map(Number);
  return sign * (h * 60 + m);
}

// Wall-clock time in a timezone -> UTC instant.
// "2026-12-01T10:00" in "Asia/Ho_Chi_Minh" -> 2026-12-01T03:00:00Z.
// Returns null for malformed or impossible dates (e.g. 2026-02-30).
export function zonedLocalToUtc(local: string, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local);
  if (!m) return null;
  const [, y, mo, d, h, mi, s = '00'] = m;
  const asUtc = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  if (!new Date(asUtc).toISOString().startsWith(`${y}-${mo}-${d}T${h}:${mi}:${s}`)) return null;

  // Two passes so the offset is taken at the real instant (handles DST changes).
  let utc = asUtc - offsetMinutes(new Date(asUtc), timeZone) * 60_000;
  utc = asUtc - offsetMinutes(new Date(utc), timeZone) * 60_000;
  return new Date(utc);
}
