import { registerAs } from '@nestjs/config';

export const sqsConfig = registerAs('sqs', () => ({
  region: process.env.AWS_REGION || 'us-east-1',
  queueUrl: process.env.SQS_QUEUE_URL || '',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
}));
