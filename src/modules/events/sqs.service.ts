import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';
import { v4 as uuidv4 } from 'uuid';

export interface PaymentEvent {
  eventType: string;
  payload: any;
  timestamp: string;
  correlationId: string;
}

@Injectable()
export class SqsService implements OnModuleInit {
  private readonly logger = new Logger(SqsService.name);
  private sqsClient: SQSClient;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.sqsClient = new SQSClient({
      region: this.configService.get('sqs.region') || 'us-east-1',
      credentials: {
        accessKeyId: this.configService.get('sqs.accessKeyId') || '',
        secretAccessKey: this.configService.get('sqs.secretAccessKey') || '',
      },
    });
  }

  async publishEvent(eventType: string, payload: any): Promise<void> {
    try {
      const message: PaymentEvent = {
        eventType,
        payload,
        timestamp: new Date().toISOString(),
        correlationId: uuidv4(),
      };

      const command = new SendMessageCommand({
        QueueUrl: this.configService.get('sqs.queueUrl'),
        MessageBody: JSON.stringify(message),
        MessageAttributes: {
          eventType: {
            DataType: 'String',
            StringValue: eventType,
          },
          correlationId: {
            DataType: 'String',
            StringValue: message.correlationId,
          },
        },
      });

      await this.sqsClient.send(command);

      this.logger.log(
        `Event published: ${eventType} - Correlation ID: ${message.correlationId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to publish event: ${eventType}`, error.stack);
      throw error;
    }
  }

  async consumeMessages(): Promise<void> {
    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: this.configService.get('sqs.queueUrl'),
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 20,
        MessageAttributeNames: ['All'],
      });

      const response = await this.sqsClient.send(command);

      if (response.Messages) {
        for (const message of response.Messages) {
          await this.processMessage(message);
        }
      }
    } catch (error) {
      this.logger.error('Failed to consume messages', error.stack);
    }
  }

  private async processMessage(message: any): Promise<void> {
    try {
      const event: PaymentEvent = JSON.parse(message.Body);
      const correlationId =
        message.MessageAttributes?.correlationId?.StringValue;

      this.logger.log(
        `Processing event: ${event.eventType} - Correlation ID: ${correlationId}`,
      );

      this.logger.log(`Event details: ${JSON.stringify(event, null, 2)}`);

      await this.deleteMessage(message.ReceiptHandle);

      this.logger.log(`Event processed successfully: ${event.eventType}`);
    } catch (error) {
      this.logger.error('Failed to process message', error.stack);
    }
  }

  private async deleteMessage(receiptHandle: string): Promise<void> {
    try {
      const command = new DeleteMessageCommand({
        QueueUrl: this.configService.get('sqs.queueUrl'),
        ReceiptHandle: receiptHandle,
      });

      await this.sqsClient.send(command);
    } catch (error) {
      this.logger.error('Failed to delete message', error.stack);
    }
  }
}
