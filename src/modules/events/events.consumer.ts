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
    const isEnabled = this.configService.get<boolean>('ENABLE_SQS_CONSUMER', false);
    
    if (!isEnabled) {
      return;
    }

    const awsAccessKey = this.configService.get('sqs.accessKeyId');
    const awsSecretKey = this.configService.get('sqs.secretAccessKey');
    
    if (!awsAccessKey || !awsSecretKey || awsAccessKey === 'your_aws_access_key_here') {
      return;
    }

    try {
      await this.sqsService.consumeMessages();
    } catch (error) {
      this.logger.error('Failed to consume payment events', error.stack);
    }
  }
}
