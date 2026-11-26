import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFavorites, parseMeeting, MAX_FAVORITES } from '../src/shared/validation.js';
import { formatReminder, meetingTimes } from '../src/shared/meeting.js';

const NOW = new Date('2026-11-26T00:00:00Z');

test('parseFavorites accepts valid timezones and removes duplicates', () => {
  const r = parseFavorites({ timezones: ['Asia/Tokyo', 'UTC', 'Asia/Tokyo'] });
  assert.deepEqual(r, { ok: true, value: ['Asia/Tokyo', 'UTC'] });
});

test('parseFavorites rejects bad input', () => {
  assert.equal(parseFavorites(undefined).ok, false);
  assert.equal(parseFavorites({ timezones: ['Mars/Base'] }).ok, false);
  assert.equal(parseFavorites({ timezones: Array(MAX_FAVORITES + 1).fill('UTC') }).ok, false);
});

test('parseMeeting computes UTC start and reminder time', () => {
  const r = parseMeeting(
    {
      title: ' Sprint review ',
      start: '2026-12-01T10:00',
      timezone: 'Asia/Ho_Chi_Minh',
      participants: [{ name: 'Aiko', timezone: 'Asia/Tokyo' }],
    },
    NOW,
  );
  assert.ok(r.ok);
  assert.equal(r.value.title, 'Sprint review');
  assert.equal(r.value.durationMinutes, 30);
  assert.equal(r.value.startUtc.toISOString(), '2026-12-01T03:00:00.000Z');
  assert.equal(r.value.remindAtUtc.toISOString(), '2026-12-01T02:45:00.000Z');
});

test('parseMeeting rejects invalid input', () => {
  const base = { title: 'x', start: '2026-12-01T10:00', timezone: 'UTC' };
  assert.equal(parseMeeting({ ...base, title: '' }, NOW).ok, false);
  assert.equal(parseMeeting({ ...base, timezone: 'Nope/Nope' }, NOW).ok, false);
  assert.equal(parseMeeting({ ...base, start: '2026-13-01T10:00' }, NOW).ok, false);
  assert.equal(parseMeeting({ ...base, durationMinutes: 0 }, NOW).ok, false);
  assert.equal(parseMeeting({ ...base, participants: [{ name: 'A', timezone: 'bad' }] }, NOW).ok, false);
  assert.equal(parseMeeting({ ...base, start: '2026-11-25T10:00' }, NOW).ok, false); // in the past
});

test('meetingTimes shows the meeting in every participant timezone', () => {
  const times = meetingTimes(new Date('2026-12-01T03:00:00Z'), 60, 'Asia/Ho_Chi_Minh', [
    { name: 'John', timezone: 'America/New_York' },
  ]);
  assert.deepEqual(
    times.map((t) => [t.name, t.start, t.end]),
    [
      ['Organizer', 'Tuesday 2026-12-01 10:00', 'Tuesday 2026-12-01 11:00'],
      ['John', 'Monday 2026-11-30 22:00', 'Monday 2026-11-30 23:00'],
    ],
  );
});

test('formatReminder lists local times', () => {
  const text = formatReminder({
    meetingId: 'm1',
    title: 'Họp sprint',
    email: 'a@example.com',
    startUtc: '2026-12-01T03:00:00.000Z',
    durationMinutes: 30,
    timezone: 'Asia/Ho_Chi_Minh',
    remindBeforeMinutes: 15,
    participants: [{ name: 'Aiko', timezone: 'Asia/Tokyo' }],
  });
  assert.match(text, /"Họp sprint" starts in 15 minutes/);
  assert.match(text, /Aiko \(Asia\/Tokyo, UTC\+09:00\): Tuesday 2026-12-01 12:00 - Tuesday 2026-12-01 12:30/);
});
