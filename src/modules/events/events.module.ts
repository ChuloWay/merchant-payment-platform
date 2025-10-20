import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SqsService } from './sqs.service';
import { SnsService } from './sns.service';
import { sqsConfig } from '../../config/sqs.config';

@Module({
  imports: [ConfigModule.forFeature(sqsConfig)],
  providers: [SqsService, SnsService],
  exports: [SqsService, SnsService],
})
export class EventsModule {}
