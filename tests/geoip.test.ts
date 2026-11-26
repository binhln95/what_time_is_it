// IP -> location -> timezone, against the real DB-IP database in layers/geoip/
// (run `npm run geoip` first; these tests are skipped when the file is missing, e.g. in CI).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

const DB = fileURLToPath(new URL('../layers/geoip/dbip-city-lite.mmdb', import.meta.url));
process.env.GEOIP_DB_PATH = DB; // read lazily on the first lookup
const skip = !existsSync(DB) && 'GeoIP database not downloaded (npm run geoip)';

const { locateIp } = await import('../src/shared/geoip.js');
const { handler } = await import('../src/functions/time.js');

// Minimal API Gateway event carrying the caller IP, like API Gateway sends it.
const fromIp = (sourceIp: string, query?: Record<string, string>) =>
  ({ queryStringParameters: query, requestContext: { http: { sourceIp } } }) as unknown as APIGatewayProxyEventV2;

test('locateIp finds country and coordinates', { skip }, () => {
  const sg = locateIp('203.116.0.1');
  assert.equal(sg?.country, 'SG');
  assert.ok(sg && Math.abs(sg.lat - 1.3) < 1);
  assert.equal(locateIp('8.8.8.8')?.country, 'US');
});

test('locateIp ignores private and invalid addresses', { skip }, () => {
  assert.equal(locateIp('10.0.0.1'), null);
  assert.equal(locateIp('192.168.1.10'), null);
  assert.equal(locateIp('not-an-ip'), null);
  assert.equal(locateIp(undefined), null);
});

test('GET /time without params uses the caller IP: VN -> +07:00, SG -> +08:00', { skip }, async () => {
  const vn = JSON.parse((await handler(fromIp('113.161.73.1'))).body!);
  assert.equal(vn.source, 'ip');
  assert.equal(vn.utcOffset, '+07:00');
  assert.equal(vn.location.country, 'VN');
  assert.equal(vn.ip, '113.161.73.1');

  const sg = JSON.parse((await handler(fromIp('203.116.0.1'))).body!);
  assert.equal(sg.source, 'ip');
  assert.equal(sg.timezone, 'Asia/Singapore');
  assert.equal(sg.utcOffset, '+08:00');
});

test('IPv6 callers are located too', { skip }, async () => {
  const res = JSON.parse((await handler(fromIp('2402:800:6371::1'))).body!);
  assert.equal(res.source, 'ip');
  assert.equal(res.utcOffset, '+07:00');
});

test('explicit ?tz= wins over the IP', { skip }, async () => {
  const res = JSON.parse((await handler(fromIp('203.116.0.1', { tz: 'Asia/Tokyo' }))).body!);
  assert.equal(res.source, 'tz');
  assert.equal(res.timezone, 'Asia/Tokyo');
  assert.equal(res.ip, undefined);
});

test('private IP falls back to UTC', { skip }, async () => {
  const res = JSON.parse((await handler(fromIp('10.0.0.1'))).body!);
  assert.equal(res.source, 'default');
  assert.equal(res.timezone, 'UTC');
});
