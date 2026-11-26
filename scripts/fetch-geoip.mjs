#!/usr/bin/env node
// Downloads the free DB-IP "IP to City Lite" database (CC BY 4.0, https://db-ip.com) into
// layers/geoip/, which template.yaml ships as a Lambda layer (mounted at /opt).
// The file (~130 MB) is not committed; run this before `sam deploy` (npm run deploy does).
// Skips the download when this month's file is already there.

import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../layers/geoip/', import.meta.url));
const file = `${dir}dbip-city-lite.mmdb`;
const versionFile = `${dir}VERSION`;

const month = (offset) => {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - offset);
  return d.toISOString().slice(0, 7); // YYYY-MM
};

mkdirSync(dir, { recursive: true });

// DB-IP publishes at the start of each month; fall back to last month early in the month.
for (const version of [month(0), month(1)]) {
  if (existsSync(file) && existsSync(versionFile) && readFileSync(versionFile, 'utf8').trim() === version) {
    console.log(`GeoIP database ${version} already present.`);
    process.exit(0);
  }
  const url = `https://download.db-ip.com/free/dbip-city-lite-${version}.mmdb.gz`;
  const res = await fetch(url);
  if (!res.ok) {
    console.log(`${url} -> HTTP ${res.status}, trying previous month`);
    continue;
  }
  console.log(`Downloading ${url} ...`);
  await pipeline(Readable.fromWeb(res.body), createGunzip(), createWriteStream(`${file}.tmp`));
  renameSync(`${file}.tmp`, file);
  writeFileSync(versionFile, `${version}\n`);
  console.log(`Saved ${file} (${version})`);
  process.exit(0);
}

console.error('Could not download the DB-IP database.');
process.exit(1);
