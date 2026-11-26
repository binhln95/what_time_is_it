// GET /time?tz=<IANA timezone>  (public)
// Returns the current time in the client's timezone.

import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { getTimeInfo, isValidTimeZone } from '../shared/time.js';
import { error, json } from '../shared/http.js';

const DEFAULT_TZ = 'UTC';

export const handler = async (
  event: Partial<APIGatewayProxyEventV2> | undefined,
): Promise<APIGatewayProxyStructuredResultV2> => {
  const tz = event?.queryStringParameters?.tz?.trim() || DEFAULT_TZ;

  if (!isValidTimeZone(tz)) {
    return error(400, 'InvalidTimeZone', `'${tz}' is not a valid IANA timezone (e.g. Asia/Ho_Chi_Minh).`);
  }

  return json(200, getTimeInfo(new Date(), tz));
};
