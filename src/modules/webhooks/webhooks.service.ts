import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PaymentsService } from '../payments/payments.service';
import { WebhookPayloadDto } from './dto/webhook-payload.dto';
import { PaymentStatus } from '../payments/entities/payment.entity';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  async processPaymentGatewayWebhook(
    webhookPayload: WebhookPayloadDto,
  ): Promise<void> {
    const { reference, status, gatewayReference, failureReason } =
      webhookPayload;

    try {
      const payment = await this.paymentsService.findByReference(reference);

      if (!payment) {
        throw new NotFoundException(
          `Payment with reference ${reference} not found`,
        );
      }

      // Allow status updates for idempotency (e.g., duplicate webhooks)
      if (payment.status === status) {
        this.logger.log(
          `Payment ${reference} already has status ${status}. Skipping update.`,
        );
        return;
      }

      await this.paymentsService.updatePaymentStatus(
        payment.id,
        status,
        gatewayReference,
        failureReason,
      );

      this.logger.log(
        `Webhook processed successfully for payment: ${reference} - Status: ${status}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process webhook for payment ${reference}:`,
        error.stack,
      );
      throw error;
    }
  }

  validateWebhookSignature(
    payload: string,
    signature: string,
  ): boolean {
    console.log('🔍 DEBUG: validateWebhookSignature called');
    console.log('📥 Received signature:', signature);
    console.log('📥 Received payload:', payload);
    
    if (!signature || !payload) {
      console.log('❌ Missing signature or payload');
      return false;
    }
  
    try {
      // In a real implementation, you would use the webhook secret from environment
      const webhookSecret = process.env.WEBHOOK_SECRET || 'test-webhook-secret';
      console.log('🔑 Using webhook secret:', webhookSecret);
      
      const expectedSignature = require('crypto')
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');
      
      console.log('🎯 Expected signature:', expectedSignature);
      console.log('📊 Signature comparison:');
      console.log('  - Received:', signature);
      console.log('  - Expected:', expectedSignature);
      console.log('  - Match:', signature === expectedSignature);
  
      // Use constant-time comparison to prevent timing attacks
      const isValid = require('crypto').timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
      
      console.log('✅ Final validation result:', isValid);
      return isValid;
    } catch (error) {
      console.log('❌ Error in signature validation:', error.message);
      return false;
    }
  }
}
