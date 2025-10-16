import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Res,
  Next,
  BadRequestException,
} from '@nestjs/common';
import { Response, NextFunction } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { WebhookPayloadDto } from './dto/webhook-payload.dto';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('payment-gateway')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Payment gateway webhook endpoint',
    description:
      'Receives payment status updates from payment gateways and processes payment completion events',
  })
  @ApiHeader({
    name: 'X-Webhook-Signature',
    description: 'Webhook signature for verification',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid webhook payload' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async handlePaymentGatewayWebhook(
    @Res() res: Response,
    @Next() next: NextFunction,
    @Body() webhookPayload: WebhookPayloadDto,
    @Headers('x-webhook-signature') signature?: string,
  ) {
    try {
      console.log('🔍 DEBUG: Webhook received');
      console.log('📥 Signature header:', signature);
      console.log(
        '📥 Webhook payload:',
        JSON.stringify(webhookPayload, null, 2),
      );

      if (signature) {
        console.log('🔐 Signature validation starting...');

        // Remove 'sha256=' prefix if present
        const cleanSignature = signature.replace('sha256=', '');
        console.log('🧹 Cleaned signature:', cleanSignature);

        const isValid = this.webhooksService.validateWebhookSignature(
          JSON.stringify(webhookPayload),
          cleanSignature,
        );

        if (!isValid) {
          console.log('❌ Signature validation failed');
          this.logger.warn(
            `Invalid webhook signature for payment: ${webhookPayload.reference}`,
          );
          throw new BadRequestException('Invalid webhook signature');
        }
        console.log('✅ Signature validation passed');
      } else {
        console.log('⚠️ No signature provided, skipping validation');
      }

      await this.webhooksService.processPaymentGatewayWebhook(webhookPayload);

      this.logger.log(
        `Webhook processed successfully for payment: ${webhookPayload.reference}`,
      );

      return res.status(HttpStatus.OK).json({
        statusCode: HttpStatus.OK,
        data: { success: true },
        message: 'Webhook processed successfully',
      });
    } catch (error) {
      this.logger.error(
        `Failed to process webhook for payment ${webhookPayload.reference}:`,
        error.stack,
      );
      next(error);
    }
  }
}
