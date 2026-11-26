// GET /favorites  -> the user's favorite timezones with their current time (world clock)
// PUT /favorites  -> replace the list, body: { "timezones": ["Asia/Tokyo", ...] }
// Requires a Cognito JWT (checked by API Gateway).
//
// DynamoDB item: PK = USER#<sub>, SK = FAVORITES, timezones = string[]

import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, env } from '../shared/aws.js';
import { error, getUser, json, parseJsonBody } from '../shared/http.js';
import { getTimeInfo } from '../shared/time.js';
import { parseFavorites } from '../shared/validation.js';

function worldClock(timezones: string[]) {
  const now = new Date();
  return { favorites: timezones.map((tz) => getTimeInfo(now, tz)) };
}

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyStructuredResultV2> => {
  const { userId } = getUser(event);
  const TableName = env('TABLE_NAME');
  const Key = { PK: `USER#${userId}`, SK: 'FAVORITES' };

  if (event.requestContext.http.method === 'PUT') {
    const parsed = parseFavorites(parseJsonBody(event));
    if (!parsed.ok) return error(400, 'InvalidBody', parsed.message);

    await ddb.send(
      new PutCommand({ TableName, Item: { ...Key, timezones: parsed.value, updatedAt: new Date().toISOString() } }),
    );
    return json(200, worldClock(parsed.value));
  }

  const { Item } = await ddb.send(new GetCommand({ TableName, Key }));
  return json(200, worldClock((Item?.timezones as string[] | undefined) ?? []));
};
