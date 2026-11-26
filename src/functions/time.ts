// GET /time  (public)
//   ?lat=<latitude>&lon=<longitude>  -> time at that location (timezone looked up from the coordinates)
//   ?tz=<IANA timezone>              -> time in that timezone
//   (nothing)                        -> UTC
// lat/lon wins when both are given.

import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { getTimeInfo, isValidTimeZone, timeZoneAt } from '../shared/time.js';
import { error, json } from '../shared/http.js';

const DEFAULT_TZ = 'UTC';

type Source = 'location' | 'tz' | 'default';

export const handler = async (
  event: Partial<APIGatewayProxyEventV2> | undefined,
): Promise<APIGatewayProxyStructuredResultV2> => {
  const q = event?.queryStringParameters ?? {};
  let tz: string;
  let source: Source;

  if (q.lat !== undefined || q.lon !== undefined) {
    const lat = Number(q.lat);
    const lon = Number(q.lon);
    const found = q.lat?.trim() && q.lon?.trim() ? timeZoneAt(lat, lon) : null;
    if (!found) {
      return error(400, 'InvalidLocation', 'lat must be -90..90 and lon -180..180 (decimal degrees), both required.');
    }
    tz = found;
    source = 'location';
  } else if (q.tz?.trim()) {
    tz = q.tz.trim();
    if (!isValidTimeZone(tz)) {
      return error(400, 'InvalidTimeZone', `'${tz}' is not a valid IANA timezone (e.g. Asia/Ho_Chi_Minh).`);
    }
    source = 'tz';
  } else {
    tz = DEFAULT_TZ;
    source = 'default';
  }

  return json(200, { ...getTimeInfo(new Date(), tz), source });
};
