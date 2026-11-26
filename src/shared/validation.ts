// Request body validation (pure, unit-tested).

import { isValidTimeZone, zonedLocalToUtc } from './time.js';
import type { Participant } from './meeting.js';

export type Result<T> = { ok: true; value: T } | { ok: false; message: string };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = <T>(message: string): Result<T> => ({ ok: false, message });

export const MAX_FAVORITES = 20;
export const MAX_PARTICIPANTS = 20;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

// PUT /favorites  body: { "timezones": ["Asia/Tokyo", ...] }
export function parseFavorites(body: unknown): Result<string[]> {
  if (!isObject(body) || !Array.isArray(body.timezones)) return fail('Body must be {"timezones": string[]}');
  const tzs = body.timezones;
  if (tzs.length > MAX_FAVORITES) return fail(`At most ${MAX_FAVORITES} timezones`);
  const invalid = tzs.filter((tz) => !isValidTimeZone(tz));
  if (invalid.length) return fail(`Invalid timezone(s): ${invalid.map(String).join(', ')}`);
  return ok([...new Set(tzs as string[])]);
}

export interface MeetingInput {
  title: string;
  start: string; // wall-clock time in `timezone`, "YYYY-MM-DDTHH:mm"
  timezone: string;
  durationMinutes: number;
  remindBeforeMinutes: number;
  participants: Participant[];
  startUtc: Date;
  remindAtUtc: Date;
}

function intInRange(value: unknown, fallback: number, min: number, max: number): number | null {
  if (value === undefined) return fallback;
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max ? (value as number) : null;
}

// POST /meetings  body: { title, start, timezone, durationMinutes?, remindBeforeMinutes?, participants? }
export function parseMeeting(body: unknown, now: Date): Result<MeetingInput> {
  if (!isObject(body)) return fail('Body must be a JSON object');

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title || title.length > 100) return fail('title is required (max 100 chars)');

  if (!isValidTimeZone(body.timezone)) return fail('timezone must be a valid IANA timezone');
  const timezone = body.timezone;

  const start = typeof body.start === 'string' ? body.start : '';
  const startUtc = zonedLocalToUtc(start, timezone);
  if (!startUtc) return fail('start must be a local date-time "YYYY-MM-DDTHH:mm"');

  const durationMinutes = intInRange(body.durationMinutes, 30, 1, 1440);
  if (durationMinutes === null) return fail('durationMinutes must be an integer 1-1440');

  const remindBeforeMinutes = intInRange(body.remindBeforeMinutes, 15, 0, 1440);
  if (remindBeforeMinutes === null) return fail('remindBeforeMinutes must be an integer 0-1440');

  const rawParticipants = body.participants ?? [];
  if (!Array.isArray(rawParticipants) || rawParticipants.length > MAX_PARTICIPANTS) {
    return fail(`participants must be an array (max ${MAX_PARTICIPANTS})`);
  }
  const participants: Participant[] = [];
  for (const p of rawParticipants) {
    const name = isObject(p) && typeof p.name === 'string' ? p.name.trim() : '';
    if (!name || name.length > 50 || !isObject(p) || !isValidTimeZone(p.timezone)) {
      return fail('each participant must be {"name": string (max 50), "timezone": IANA timezone}');
    }
    participants.push({ name, timezone: p.timezone });
  }

  const remindAtUtc = new Date(startUtc.getTime() - remindBeforeMinutes * 60_000);
  if (remindAtUtc.getTime() < now.getTime() + 60_000) {
    return fail('The reminder time must be at least 1 minute in the future');
  }

  return ok({ title, start, timezone, durationMinutes, remindBeforeMinutes, participants, startUtc, remindAtUtc });
}
