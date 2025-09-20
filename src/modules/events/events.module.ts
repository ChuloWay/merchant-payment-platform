import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { SqsService } from './sqs.service';
import { EventsConsumer } from './events.consumer';
import { sqsConfig } from '../../config/sqs.config';

@Module({
  imports: [ConfigModule.forFeature(sqsConfig), ScheduleModule.forRoot()],
  providers: [SqsService, EventsConsumer],
  exports: [SqsService],
})
export class EventsModule {}
