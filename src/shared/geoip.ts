// IP address -> location, using the DB-IP "IP to City Lite" database (CC BY 4.0, https://db-ip.com)
// shipped as a Lambda layer (/opt/dbip-city-lite.mmdb). No external API is called.
//
// The ~130 MB database is loaded lazily on the first lookup and then reused by the warm
// Lambda container, so requests that do not need it (?tz=, ?lat=&lon=) stay cheap.

import { existsSync, readFileSync } from 'node:fs';
import { isIP } from 'node:net';
import { Reader, type CityResponse } from 'mmdb-lib';

export const DEFAULT_GEOIP_DB_PATH = '/opt/dbip-city-lite.mmdb';

export interface IpLocation {
  ip: string;
  country?: string; // ISO 3166-1 alpha-2, e.g. "VN"
  region?: string; // e.g. "Da Nang"
  city?: string;
  lat: number;
  lon: number;
}

let reader: Reader<CityResponse> | null | undefined; // undefined = not loaded yet, null = unavailable

function getReader(): Reader<CityResponse> | null {
  if (reader === undefined) {
    const path = process.env.GEOIP_DB_PATH ?? DEFAULT_GEOIP_DB_PATH;
    if (existsSync(path)) {
      reader = new Reader<CityResponse>(readFileSync(path));
    } else {
      console.warn(JSON.stringify({ msg: 'GeoIP database not found, IP lookup disabled', path }));
      reader = null;
    }
  }
  return reader;
}

// Location of a public IP (v4 or v6). Null for private/unknown addresses or when the
// database is not available (e.g. unit tests, sam local without the layer).
export function locateIp(ip: string | undefined): IpLocation | null {
  if (!ip || !isIP(ip)) return null;
  const db = getReader();
  if (!db) return null;
  try {
    const hit = db.get(ip);
    const loc = hit?.location;
    if (!hit || loc?.latitude === undefined || loc.longitude === undefined) return null;
    return {
      ip,
      country: hit.country?.iso_code,
      region: hit.subdivisions?.[0]?.names?.en,
      city: hit.city?.names?.en,
      lat: loc.latitude,
      lon: loc.longitude,
    };
  } catch {
    return null;
  }
}
