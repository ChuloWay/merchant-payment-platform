import { registerAs } from '@nestjs/config';

export const sqsConfig = registerAs('sqs', () => ({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test-access-key',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test-secret-key',
  queueUrl: process.env.SQS_QUEUE_URL || 'https://sqs.us-east-1.amazonaws.com/123456789012/payment-events',
  endpoint: process.env.SQS_ENDPOINT || undefined,
}));