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
    _payload: string,
    _signature: string,
  ): boolean {
    return true;
  }
}
