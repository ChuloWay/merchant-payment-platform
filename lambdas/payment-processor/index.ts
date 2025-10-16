import { SQSEvent, SQSHandler, SQSRecord } from 'aws-lambda';
import { Client, Connection } from '@temporalio/client';
import { PaymentEvent, SNSMessage } from '../shared/types/events';
import { Logger } from '../shared/utils/logger';

const logger = new Logger('PaymentProcessor');

let temporalClient: Client | null = null;

async function getTemporalClient(): Promise<Client | null> {
  if (temporalClient) {
    return temporalClient;
  }

  const isEnabled = process.env.ENABLE_TEMPORAL_WORKFLOWS === 'true';
  
  if (!isEnabled) {
    logger.warn('Temporal workflows disabled via ENABLE_TEMPORAL_WORKFLOWS flag');
    return null;
  }

  try {
    const temporalAddress = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
    const namespace = process.env.TEMPORAL_NAMESPACE || 'default';

    const connection = await Connection.connect({ address: temporalAddress });
    temporalClient = new Client({ connection, namespace });

    logger.log(`Temporal client initialized: ${temporalAddress} | Namespace: ${namespace}`);
    return temporalClient;
  } catch (error) {
    logger.error('Failed to initialize Temporal client', error);
    return null;
  }
}

export const handler: SQSHandler = async (event: SQSEvent): Promise<void> => {
  logger.log(`Received ${event.Records.length} messages from SQS`);

  for (const record of event.Records) {
    try {
      await processRecord(record);
    } catch (error) {
      logger.error('Failed to process record', error);
      throw error;
    }
  }

  logger.log('All messages processed successfully');
};

async function processRecord(record: SQSRecord): Promise<void> {
  logger.log(`Processing message`, { messageId: record.messageId });

  const snsMessage: SNSMessage = JSON.parse(record.body);
  
  const paymentEvent: PaymentEvent = JSON.parse(snsMessage.Message);

  logger.log(`Payment event received`, {
    eventType: paymentEvent.eventType,
    eventId: paymentEvent.eventId,
    correlationId: paymentEvent.correlationId,
    paymentId: paymentEvent.payload.paymentId,
    reference: paymentEvent.payload.reference,
  });

  switch (paymentEvent.eventType) {
    case 'payment.initiated':
      await handlePaymentInitiated(paymentEvent);
      break;
    case 'payment.completed':
      await handlePaymentCompleted(paymentEvent);
      break;
    case 'payment.failed':
      await handlePaymentFailed(paymentEvent);
      break;
    default:
      logger.warn(`Unknown event type: ${paymentEvent.eventType}`);
  }
}

async function handlePaymentInitiated(event: PaymentEvent): Promise<void> {
  logger.log('='.repeat(60));
  logger.log('🚀 PAYMENT INITIATED', {
    reference: event.payload.reference,
    amount: event.payload.amount,
    currency: event.payload.currency,
    merchantId: event.payload.merchantId,
  });
  logger.log('='.repeat(60));

  const client = await getTemporalClient();
  
  if (!client) {
    logger.warn('Temporal client not available, skipping workflow start');
    return;
  }

  try {
    const taskQueue = process.env.TEMPORAL_TASK_QUEUE || 'payment-processing';
    const workflowId = `payment-${event.payload.paymentId}-${Date.now()}`;

    const handle = await client.workflow.start('PaymentProcessingWorkflow', {
      taskQueue,
      workflowId,
      args: [{
        paymentId: event.payload.paymentId,
        reference: event.payload.reference,
        amount: event.payload.amount,
        currency: event.payload.currency,
        merchantId: event.payload.merchantId,
        paymentMethodId: event.payload.paymentMethodId,
        metadata: event.payload.metadata,
      }],
      workflowExecutionTimeout: '10m',
      workflowRunTimeout: '5m',
      workflowTaskTimeout: '1m',
    });

    logger.log('✅ Temporal workflow started', {
      workflowId: handle.workflowId,
      runId: handle.firstExecutionRunId,
      paymentId: event.payload.paymentId,
    });
  } catch (error) {
    logger.error('Failed to start Temporal workflow', error);
    throw error;
  }
}

async function handlePaymentCompleted(event: PaymentEvent): Promise<void> {
  logger.log('✅ PAYMENT COMPLETED', {
    reference: event.payload.reference,
    amount: event.payload.amount,
  });

  logger.log('TODO: Trigger post-completion workflows');
  logger.log('- Update analytics');
  logger.log('- Send success notifications');
}

async function handlePaymentFailed(event: PaymentEvent): Promise<void> {
  logger.error('❌ PAYMENT FAILED', {
    reference: event.payload.reference,
    reason: event.payload.failureReason,
  });

  logger.log('TODO: Handle failure workflows');
  logger.log('- Send failure notifications');
  logger.log('- Log to monitoring system');
}

