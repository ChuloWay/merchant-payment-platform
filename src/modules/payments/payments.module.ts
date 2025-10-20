import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { Payment } from './entities/payment.entity';
import { PaymentMethod } from '../payment-methods/entities/payment-method.entity';
import { Merchant } from '../merchants/entities/merchant.entity';
import { EventsModule } from '../events/events.module';
import { MerchantsModule } from '../merchants/merchants.module';
import { TemporalModule } from '../../temporal/temporal.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, PaymentMethod, Merchant]),
    EventsModule,
    MerchantsModule,
    TemporalModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
