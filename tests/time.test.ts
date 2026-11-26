import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getTimeInfo, isValidTimeZone, offsetMinutes, timeZoneAt, zonedLocalToUtc } from '../src/shared/time.js';
import { handler } from '../src/functions/time.js';

test('getTimeInfo converts to Asia/Ho_Chi_Minh (+07:00)', () => {
  const info = getTimeInfo(new Date('2026-11-26T05:30:15.123Z'), 'Asia/Ho_Chi_Minh');
  assert.equal(info.datetime, '2026-11-26T12:30:15.123+07:00');
  assert.equal(info.utcOffset, '+07:00');
  assert.equal(info.dayOfWeek, 'Thursday');
  assert.equal(info.unixTime, 1795671015);
});

test('getTimeInfo handles UTC and midnight', () => {
  const info = getTimeInfo(new Date('2026-01-01T00:00:00.000Z'), 'UTC');
  assert.equal(info.datetime, '2026-01-01T00:00:00.000+00:00');
  assert.equal(info.time, '00:00:00');
});

test('getTimeInfo handles negative offsets and DST', () => {
  assert.equal(getTimeInfo(new Date('2026-07-01T12:00:00Z'), 'America/New_York').utcOffset, '-04:00');
  assert.equal(getTimeInfo(new Date('2026-01-01T12:00:00Z'), 'America/New_York').utcOffset, '-05:00');
});

test('isValidTimeZone', () => {
  assert.ok(isValidTimeZone('Europe/London'));
  assert.ok(!isValidTimeZone('Mars/Base'));
  assert.ok(!isValidTimeZone(''));
});

test('offsetMinutes handles half-hour and negative offsets', () => {
  const d = new Date('2026-01-01T00:00:00Z');
  assert.equal(offsetMinutes(d, 'Asia/Kolkata'), 330);
  assert.equal(offsetMinutes(d, 'America/New_York'), -300);
});

test('zonedLocalToUtc converts wall-clock time to UTC', () => {
  assert.equal(zonedLocalToUtc('2026-12-01T10:00', 'Asia/Ho_Chi_Minh')?.toISOString(), '2026-12-01T03:00:00.000Z');
  assert.equal(zonedLocalToUtc('2026-07-01T08:00', 'America/New_York')?.toISOString(), '2026-07-01T12:00:00.000Z');
  assert.equal(zonedLocalToUtc('2026-01-01T08:00', 'America/New_York')?.toISOString(), '2026-01-01T13:00:00.000Z');
  // first hour after the DST switch (2026-03-08 02:00 -> 03:00 in New York)
  assert.equal(zonedLocalToUtc('2026-03-08T03:30', 'America/New_York')?.toISOString(), '2026-03-08T07:30:00.000Z');
});

test('zonedLocalToUtc rejects malformed or impossible dates', () => {
  assert.equal(zonedLocalToUtc('2026-02-30T10:00', 'UTC'), null);
  assert.equal(zonedLocalToUtc('tomorrow', 'UTC'), null);
});

test('time handler returns 200 with tz', async () => {
  const res = await handler({ queryStringParameters: { tz: 'Asia/Tokyo' } });
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body!);
  assert.equal(body.timezone, 'Asia/Tokyo');
  assert.equal(body.utcOffset, '+09:00');
});

test('time handler defaults to UTC', async () => {
  const res = await handler({});
  assert.equal(JSON.parse(res.body!).timezone, 'UTC');
});

test('timeZoneAt maps coordinates to IANA timezones', () => {
  assert.equal(timeZoneAt(10.78, 106.7), 'Asia/Ho_Chi_Minh'); // Ho Chi Minh City
  assert.equal(timeZoneAt(1.29, 103.85), 'Asia/Singapore');
  assert.equal(timeZoneAt(35.68, 139.69), 'Asia/Tokyo');
  assert.equal(timeZoneAt(40.71, -74.0), 'America/New_York');
});

test('timeZoneAt rejects invalid coordinates', () => {
  assert.equal(timeZoneAt(91, 0), null);
  assert.equal(timeZoneAt(0, -181), null);
  assert.equal(timeZoneAt(NaN, 10), null);
});

test('time handler uses the location: VN -> +07:00, Singapore -> +08:00', async () => {
  const vn = JSON.parse((await handler({ queryStringParameters: { lat: '10.78', lon: '106.70' } })).body!);
  assert.equal(vn.timezone, 'Asia/Ho_Chi_Minh');
  assert.equal(vn.utcOffset, '+07:00');
  assert.equal(vn.source, 'location');

  const sg = JSON.parse((await handler({ queryStringParameters: { lat: '1.29', lon: '103.85' } })).body!);
  assert.equal(sg.timezone, 'Asia/Singapore');
  assert.equal(sg.utcOffset, '+08:00');
});

test('time handler prefers lat/lon over tz', async () => {
  const res = await handler({ queryStringParameters: { lat: '1.29', lon: '103.85', tz: 'Asia/Tokyo' } });
  assert.equal(JSON.parse(res.body!).timezone, 'Asia/Singapore');
});

test('time handler returns 400 for invalid or partial coordinates', async () => {
  for (const q of [{ lat: '1.29' }, { lat: 'abc', lon: '103' }, { lat: '95', lon: '10' }, { lat: '', lon: '' }]) {
    const res = await handler({ queryStringParameters: q });
    assert.equal(res.statusCode, 400, JSON.stringify(q));
    assert.equal(JSON.parse(res.body!).error, 'InvalidLocation');
  }
});

test('time handler returns 400 for invalid tz', async () => {
  const res = await handler({ queryStringParameters: { tz: 'Not/AZone' } });
  assert.equal(res.statusCode, 400);
  assert.equal(JSON.parse(res.body!).error, 'InvalidTimeZone');
});
