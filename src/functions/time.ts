// GET /time  (public) - current time, in the timezone picked by the first match of:
//   1. ?lat=<latitude>&lon=<longitude>  timezone of that point
//   2. ?tz=<IANA timezone>              that timezone
//   3. the caller's IP address          API Gateway passes it (requestContext.http.sourceIp);
//                                       located with the DB-IP database, then point -> timezone
//   4. UTC                              e.g. private IP or no GeoIP database
// The response field `source` says which one was used (location | tz | ip | default).

import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { getTimeInfo, isValidTimeZone, timeZoneAt } from '../shared/time.js';
import { locateIp, type IpLocation } from '../shared/geoip.js';
import { error, json } from '../shared/http.js';

const DEFAULT_TZ = 'UTC';

type Source = 'location' | 'tz' | 'ip' | 'default';

export const handler = async (
  event: Partial<APIGatewayProxyEventV2> | undefined,
): Promise<APIGatewayProxyStructuredResultV2> => {
  const q = event?.queryStringParameters ?? {};
  let tz: string | null = null;
  let source: Source = 'default';
  let ipLocation: IpLocation | null = null;

  if (q.lat !== undefined || q.lon !== undefined) {
    tz = q.lat?.trim() && q.lon?.trim() ? timeZoneAt(Number(q.lat), Number(q.lon)) : null;
    if (!tz) {
      return error(400, 'InvalidLocation', 'lat must be -90..90 and lon -180..180 (decimal degrees), both required.');
    }
    source = 'location';
  } else if (q.tz?.trim()) {
    tz = q.tz.trim();
    if (!isValidTimeZone(tz)) {
      return error(400, 'InvalidTimeZone', `'${tz}' is not a valid IANA timezone (e.g. Asia/Ho_Chi_Minh).`);
    }
    source = 'tz';
  } else {
    ipLocation = locateIp(event?.requestContext?.http?.sourceIp);
    tz = ipLocation ? timeZoneAt(ipLocation.lat, ipLocation.lon) : null;
    if (tz) source = 'ip';
  }

  return json(200, {
    ...getTimeInfo(new Date(), tz ?? DEFAULT_TZ),
    source,
    ...(source === 'ip' && ipLocation
      ? {
          ip: ipLocation.ip,
          location: { city: ipLocation.city, region: ipLocation.region, country: ipLocation.country },
        }
      : {}),
  });
};
