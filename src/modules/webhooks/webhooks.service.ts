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

      if (payment.status !== PaymentStatus.PENDING) {
        this.logger.warn(
          `Payment ${reference} is not in pending status. Current status: ${payment.status}`,
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
    if (!signature || !payload) {
      return false;
    }

    try {
      // In a real implementation, you would use the webhook secret from environment
      const webhookSecret = process.env.WEBHOOK_SECRET || 'test-webhook-secret';
      
      const expectedSignature = require('crypto')
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');

      // Use constant-time comparison to prevent timing attacks
      return require('crypto').timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      return false;
    }
  }
}
