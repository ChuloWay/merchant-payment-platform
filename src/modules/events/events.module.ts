import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { SqsService } from './sqs.service';
import { SnsService } from './sns.service';
import { EventsConsumer } from './events.consumer';
import { sqsConfig } from '../../config/sqs.config';

@Module({
  imports: [ConfigModule.forFeature(sqsConfig), ScheduleModule.forRoot()],
  providers: [SqsService, SnsService, EventsConsumer],
  exports: [SqsService, SnsService],
})
export class EventsModule {}
