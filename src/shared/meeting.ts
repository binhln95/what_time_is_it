// Meeting domain types and pure helpers (unit-tested).

import { getTimeInfo } from './time.js';

export interface Participant {
  name: string;
  timezone: string;
}

export interface Meeting {
  id: string;
  title: string;
  start: string;
  timezone: string;
  startUtc: string;
  durationMinutes: number;
  remindBeforeMinutes: number;
  remindAtUtc: string;
  participants: Participant[];
  createdAt: string;
}

// Sent by EventBridge Scheduler -> SQS -> notify Lambda.
export interface ReminderPayload {
  meetingId: string;
  title: string;
  email: string;
  startUtc: string;
  durationMinutes: number;
  timezone: string;
  remindBeforeMinutes: number;
  participants: Participant[];
}

export interface ParticipantTime {
  name: string;
  timezone: string;
  start: string; // "Tuesday 2026-12-01 10:00"
  end: string;
  utcOffset: string;
}

const short = (d: Date, tz: string) => {
  const t = getTimeInfo(d, tz);
  return `${t.dayOfWeek} ${t.date} ${t.time.slice(0, 5)}`;
};

// Meeting start/end for the organizer (first) and every participant, each in their own timezone.
export function meetingTimes(
  startUtc: Date,
  durationMinutes: number,
  organizerTz: string,
  participants: Participant[],
): ParticipantTime[] {
  const endUtc = new Date(startUtc.getTime() + durationMinutes * 60_000);
  return [{ name: 'Organizer', timezone: organizerTz }, ...participants].map((p) => ({
    name: p.name,
    timezone: p.timezone,
    start: short(startUtc, p.timezone),
    end: short(endUtc, p.timezone),
    utcOffset: getTimeInfo(startUtc, p.timezone).utcOffset,
  }));
}

export function meetingView(m: Meeting) {
  return { ...m, times: meetingTimes(new Date(m.startUtc), m.durationMinutes, m.timezone, m.participants) };
}

export function formatReminder(r: ReminderPayload): string {
  const lines = meetingTimes(new Date(r.startUtc), r.durationMinutes, r.timezone, r.participants).map(
    (t) => `- ${t.name} (${t.timezone}, UTC${t.utcOffset}): ${t.start} - ${t.end}`,
  );
  return [`"${r.title}" starts in ${r.remindBeforeMinutes} minutes.`, '', 'Local times:', ...lines].join('\n');
}
