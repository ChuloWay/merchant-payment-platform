"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const logger_1 = require("../shared/utils/logger");
const logger = new logger_1.Logger('WebhookSender');
const handler = async (event) => {
    logger.log(`Received ${event.Records.length} webhook messages from SQS`);
    for (const record of event.Records) {
        try {
            await processWebhook(record);
        }
        catch (error) {
            logger.error('Failed to process webhook', error);
            throw error;
        }
    }
    logger.log('All webhooks processed successfully');
};
exports.handler = handler;
async function processWebhook(record) {
    const snsMessage = JSON.parse(record.body);
    const paymentEvent = JSON.parse(snsMessage.Message);
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
