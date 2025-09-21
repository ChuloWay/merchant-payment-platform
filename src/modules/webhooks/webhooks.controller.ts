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
      if (signature) {
        const isValid = this.webhooksService.validateWebhookSignature(
          JSON.stringify(webhookPayload),
          signature,
        );

        if (!isValid) {
          this.logger.warn(
            `Invalid webhook signature for payment: ${webhookPayload.reference}`,
          );
          throw new BadRequestException('Invalid webhook signature');
        }
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
