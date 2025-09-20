import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SqsService } from './sqs.service';

@Injectable()
export class EventsConsumer {
  private readonly logger = new Logger(EventsConsumer.name);

  constructor(
    private readonly sqsService: SqsService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handlePaymentEvents() {
    // Only run SQS consumer if AWS credentials are properly configured
    const awsAccessKey = this.configService.get('sqs.accessKeyId');
    const awsSecretKey = this.configService.get('sqs.secretAccessKey');
    
    if (!awsAccessKey || !awsSecretKey || awsAccessKey === 'your_aws_access_key_here') {
      return; // Skip SQS consumption if credentials are not configured
    }

    try {
      await this.sqsService.consumeMessages();
    } catch (error) {
      this.logger.error('Failed to consume payment events', error.stack);
    }
  }
}
