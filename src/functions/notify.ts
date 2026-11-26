// SQS consumer: EventBridge Scheduler drops a ReminderPayload into the queue at reminder
// time; this function publishes it to the SNS topic. The `email` message attribute is
// matched by each subscription's filter policy, so only the organizer gets the email.
//
// Failed records are reported individually (ReportBatchItemFailures) and retried;
// after 3 attempts SQS moves them to the dead-letter queue.

import type { SQSBatchResponse, SQSEvent } from 'aws-lambda';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { env } from '../shared/aws.js';
import { type ReminderPayload, formatReminder } from '../shared/meeting.js';

const sns = new SNSClient({});

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

  for (const record of event.Records) {
    try {
      const reminder = JSON.parse(record.body) as ReminderPayload;
      await sns.send(
        new PublishCommand({
          TopicArn: env('REMINDER_TOPIC_ARN'),
          Subject: 'Meeting reminder', // SNS subjects must be ASCII, so the title goes in the body
          Message: formatReminder(reminder),
          MessageAttributes: { email: { DataType: 'String', StringValue: reminder.email } },
        }),
      );
      console.log(JSON.stringify({ msg: 'reminder sent', meetingId: reminder.meetingId }));
    } catch (err) {
      console.error(JSON.stringify({ msg: 'reminder failed', messageId: record.messageId, err: String(err) }));
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
