"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const logger_1 = require("../shared/utils/logger");
const logger = new logger_1.Logger('PaymentProcessor');
const handler = async (event) => {
    logger.log(`Received ${event.Records.length} messages from SQS`);
    for (const record of event.Records) {
        try {
            await processRecord(record);
        }
        catch (error) {
            logger.error('Failed to process record', error);
            throw error;
        }
    }
    logger.log('All messages processed successfully');
};
exports.handler = handler;
async function processRecord(record) {
    logger.log(`Processing message`, { messageId: record.messageId });
    const snsMessage = JSON.parse(record.body);
    const paymentEvent = JSON.parse(snsMessage.Message);
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
async function handlePaymentInitiated(event) {
    logger.log('='.repeat(60));
    logger.log('🚀 PAYMENT INITIATED', {
        reference: event.payload.reference,
        amount: event.payload.amount,
        currency: event.payload.currency,
        merchantId: event.payload.merchantId,
    });
    logger.log('='.repeat(60));
    logger.log('TODO: Start Temporal workflow for payment processing');
    logger.log('This will be implemented in Phase 4');
}
async function handlePaymentCompleted(event) {
    logger.log('✅ PAYMENT COMPLETED', {
        reference: event.payload.reference,
        amount: event.payload.amount,
    });
    logger.log('TODO: Trigger post-completion workflows');
    logger.log('- Update analytics');
    logger.log('- Send success notifications');
}
async function handlePaymentFailed(event) {
    logger.error('❌ PAYMENT FAILED', {
        reference: event.payload.reference,
        reason: event.payload.failureReason,
    });
    logger.log('TODO: Handle failure workflows');
    logger.log('- Send failure notifications');
    logger.log('- Log to monitoring system');
}
