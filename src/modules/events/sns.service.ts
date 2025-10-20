import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { v4 as uuidv4 } from 'uuid';

export interface PaymentEvent {
  eventType: string;
  eventId: string;
  timestamp: string;
  correlationId: string;
  payload: any;
}

@Injectable()
export class SnsService implements OnModuleInit {
  private readonly logger = new Logger(SnsService.name);
  private snsClient: SNSClient | null = null;
  private topicArn: string | undefined;
  private isEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.topicArn = this.configService.get<string>('PAYMENT_EVENTS_TOPIC_ARN');
    this.isEnabled = this.configService.get<boolean>('ENABLE_SNS_PUBLISHING', false);
  }

  onModuleInit() {
    if (!this.isEnabled) {
      this.logger.warn('SNS publishing is disabled via ENABLE_SNS_PUBLISHING flag');
      return;
    }

    try {
      const endpoint = this.configService.get<string>('SNS_ENDPOINT');
      const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
      const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID', 'test');
      const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY', 'test');
      
      this.snsClient = new SNSClient({
        region,
        endpoint: endpoint || undefined,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      
      this.logger.log(`SNS client initialized successfully`);
      this.logger.log(`Topic ARN: ${this.topicArn}`);
      this.logger.log(`Endpoint: ${endpoint || 'AWS (production)'}`);
    } catch (error) {
      this.logger.error('SNS client initialization failed', error);
      this.snsClient = null;
    }
  }

  async publishEvent(eventType: string, payload: any): Promise<string | null> {
    if (!this.isEnabled) {
      this.logger.debug(`SNS disabled - would have published: ${eventType}`);
      return null;
    }

    if (!this.snsClient) {
      this.logger.warn(`SNS client not available, skipping event: ${eventType}`);
      return null;
    }

    if (!this.topicArn) {
      this.logger.error('SNS Topic ARN not configured');
      return null;
    }

    try {
      const event: PaymentEvent = {
        eventType,
        eventId: uuidv4(),
        timestamp: new Date().toISOString(),
        correlationId: payload.correlationId || uuidv4(),
        payload,
      };

      const command = new PublishCommand({
        TopicArn: this.topicArn,
        Message: JSON.stringify(event),
        MessageAttributes: {
          eventType: {
            DataType: 'String',
            StringValue: eventType,
          },
          correlationId: {
            DataType: 'String',
            StringValue: event.correlationId,
          },
          timestamp: {
            DataType: 'String',
            StringValue: event.timestamp,
          },
        },
      });

      const result = await this.snsClient.send(command);
      
      this.logger.log(
        `✓ Event published to SNS: ${eventType} | EventId: ${event.eventId} | MessageId: ${result.MessageId || 'N/A'}`
      );
      
      return result.MessageId || null;
    } catch (error) {
      this.logger.error(`Failed to publish event to SNS: ${eventType}`, error.stack);
      throw error;
    }
  }

  async publishPaymentEvent(
    eventType: 'payment.initiated' | 'payment.completed' | 'payment.failed' | 'payment.cancelled' | 'payment.refunded',
    paymentData: any
  ): Promise<string | null> {
    return this.publishEvent(eventType, paymentData);
  }

  isServiceEnabled(): boolean {
    return this.isEnabled && this.snsClient !== null;
  }
}

