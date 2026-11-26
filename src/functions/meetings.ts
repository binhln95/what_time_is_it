// POST /meetings       -> create a meeting + schedule an email reminder
// GET  /meetings       -> list the user's meetings
// GET  /meetings/{id}  -> one meeting, with start/end in every participant's timezone
// Requires a Cognito JWT (checked by API Gateway).
//
// DynamoDB items (PK = USER#<sub>):
//   SK = MEETING#<id>   the meeting (auto-deleted by TTL 7 days after it starts)
//   SK = SUBSCRIPTION   marks that the user's email is subscribed to the reminder SNS topic

import { randomUUID } from 'node:crypto';
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { CreateScheduleCommand, SchedulerClient } from '@aws-sdk/client-scheduler';
import { SNSClient, SubscribeCommand } from '@aws-sdk/client-sns';
import { ddb, env } from '../shared/aws.js';
import { error, getUser, json, parseJsonBody, type User } from '../shared/http.js';
import { type Meeting, type ReminderPayload, meetingView } from '../shared/meeting.js';
import { getTimeInfo } from '../shared/time.js';
import { parseMeeting } from '../shared/validation.js';

const scheduler = new SchedulerClient({});
const sns = new SNSClient({});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MEETING_FIELDS = [
  'id', 'title', 'start', 'timezone', 'startUtc', 'durationMinutes',
  'remindBeforeMinutes', 'remindAtUtc', 'participants', 'createdAt',
] as const;

const toMeeting = (item: Record<string, unknown>) =>
  Object.fromEntries(MEETING_FIELDS.map((f) => [f, item[f]])) as unknown as Meeting;

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyStructuredResultV2> => {
  const user = getUser(event);
  switch (event.routeKey) {
    case 'POST /meetings':
      return createMeeting(event, user);
    case 'GET /meetings':
      return listMeetings(user);
    case 'GET /meetings/{id}':
      return getMeeting(user, event.pathParameters?.id);
    default:
      return error(404, 'NotFound', `No route for ${event.routeKey}`);
  }
};

async function createMeeting(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  user: User,
): Promise<APIGatewayProxyStructuredResultV2> {
  if (!user.email) return error(400, 'MissingEmail', 'Send the Cognito ID token (it carries the email claim).');

  const parsed = parseMeeting(parseJsonBody(event), new Date());
  if (!parsed.ok) return error(400, 'InvalidBody', parsed.message);
  const input = parsed.value;

  const id = randomUUID();
  const subscription = await ensureSubscribed(user.userId, user.email);

  // One-time schedule, expressed in the meeting's own timezone.
  const remindLocal = getTimeInfo(input.remindAtUtc, input.timezone);
  const payload: ReminderPayload = {
    meetingId: id,
    title: input.title,
    email: user.email,
    startUtc: input.startUtc.toISOString(),
    durationMinutes: input.durationMinutes,
    timezone: input.timezone,
    remindBeforeMinutes: input.remindBeforeMinutes,
    participants: input.participants,
  };
  await scheduler.send(
    new CreateScheduleCommand({
      Name: `meeting-${id}`,
      GroupName: env('SCHEDULE_GROUP'),
      ScheduleExpression: `at(${remindLocal.date}T${remindLocal.time})`,
      ScheduleExpressionTimezone: input.timezone,
      FlexibleTimeWindow: { Mode: 'OFF' },
      ActionAfterCompletion: 'DELETE',
      Target: {
        Arn: env('REMINDER_QUEUE_ARN'),
        RoleArn: env('SCHEDULER_ROLE_ARN'),
        Input: JSON.stringify(payload),
      },
    }),
  );

  const meeting: Meeting = {
    id,
    title: input.title,
    start: input.start,
    timezone: input.timezone,
    startUtc: input.startUtc.toISOString(),
    durationMinutes: input.durationMinutes,
    remindBeforeMinutes: input.remindBeforeMinutes,
    remindAtUtc: input.remindAtUtc.toISOString(),
    participants: input.participants,
    createdAt: new Date().toISOString(),
  };
  await ddb.send(
    new PutCommand({
      TableName: env('TABLE_NAME'),
      Item: {
        PK: `USER#${user.userId}`,
        SK: `MEETING#${id}`,
        ...meeting,
        ttl: Math.floor(input.startUtc.getTime() / 1000) + 7 * 24 * 3600,
      },
    }),
  );

  return json(201, { ...meetingView(meeting), subscription });
}

async function listMeetings(user: User): Promise<APIGatewayProxyStructuredResultV2> {
  const { Items = [] } = await ddb.send(
    new QueryCommand({
      TableName: env('TABLE_NAME'),
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: { ':pk': `USER#${user.userId}`, ':sk': 'MEETING#' },
    }),
  );
  const meetings = Items.map(toMeeting).sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  return json(200, { meetings });
}

async function getMeeting(user: User, id: string | undefined): Promise<APIGatewayProxyStructuredResultV2> {
  if (!id || !UUID_RE.test(id)) return error(400, 'InvalidId', 'Meeting id must be a UUID');
  const { Item } = await ddb.send(
    new GetCommand({ TableName: env('TABLE_NAME'), Key: { PK: `USER#${user.userId}`, SK: `MEETING#${id}` } }),
  );
  if (!Item) return error(404, 'NotFound', 'Meeting not found');
  return json(200, meetingView(toMeeting(Item)));
}

// Subscribe the user's email to the reminder topic once, with a filter policy so
// they only receive messages addressed to them. SNS emails a confirmation link first.
async function ensureSubscribed(userId: string, email: string): Promise<'subscribed' | 'pending-confirmation'> {
  const TableName = env('TABLE_NAME');
  const Key = { PK: `USER#${userId}`, SK: 'SUBSCRIPTION' };
  const { Item } = await ddb.send(new GetCommand({ TableName, Key }));
  if (Item?.email === email) return 'subscribed';

  await sns.send(
    new SubscribeCommand({
      TopicArn: env('REMINDER_TOPIC_ARN'),
      Protocol: 'email',
      Endpoint: email,
      Attributes: { FilterPolicy: JSON.stringify({ email: [email] }) },
    }),
  );
  await ddb.send(new PutCommand({ TableName, Item: { ...Key, email, createdAt: new Date().toISOString() } }));
  return 'pending-confirmation';
}
