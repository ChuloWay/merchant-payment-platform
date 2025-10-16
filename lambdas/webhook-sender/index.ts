import { SQSEvent, SQSHandler, SQSRecord } from 'aws-lambda';
import { PaymentEvent, SNSMessage } from '../shared/types/events';
import { Logger } from '../shared/utils/logger';

const logger = new Logger('WebhookSender');

export const handler: SQSHandler = async (event: SQSEvent): Promise<void> {
  logger.log(`Received ${event.Records.length} webhook messages from SQS`);

  for (const record of event.Records) {
    try {
      await processWebhook(record);
    } catch (error) {
      logger.error('Failed to process webhook', error);
      throw error;
    }
  }

  logger.log('All webhooks processed successfully');
};

async function processWebhook(record: SQSRecord): Promise<void> {
  const snsMessage: SNSMessage = JSON.parse(record.body);
  const paymentEvent: PaymentEvent = JSON.parse(snsMessage.Message);

  logger.log(`📤 Preparing to send webhook`, {
    eventType: paymentEvent.eventType,
    reference: paymentEvent.payload.reference,
    merchantId: paymentEvent.payload.merchantId,
  });

  const webhookPayload = {
    event: paymentEvent.eventType,
    eventId: paymentEvent.eventId,
    timestamp: paymentEvent.timestamp,
    data: {
      reference: paymentEvent.payload.reference,
      amount: paymentEvent.payload.amount,
      currency: paymentEvent.payload.currency,
      status: paymentEvent.payload.status,
      gatewayReference: paymentEvent.payload.gatewayReference,
      metadata: paymentEvent.payload.metadata,
    },
  };

  logger.log('='.repeat(60));
  logger.log('📨 WEBHOOK TO MERCHANT', {
    merchantId: paymentEvent.payload.merchantId,
    event: paymentEvent.eventType,
    payload: webhookPayload,
  });
  logger.log('='.repeat(60));

  logger.log('TODO: Implement actual webhook delivery');
  logger.log('- Fetch merchant webhook URL from database');
  logger.log('- Generate HMAC signature');
  logger.log('- Send HTTP POST with retry logic');
  logger.log('- Handle delivery failures');
}

