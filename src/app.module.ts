import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerModuleOptions } from '@nestjs/throttler';
import { TerminusModule } from '@nestjs/terminus';
import { appConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';
import { MerchantsModule } from './modules/merchants/merchants.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PaymentMethodsModule } from './modules/payment-methods/payment-methods.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { EventsModule } from './modules/events/events.module';
import { HealthController } from './common/health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.name'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        synchronize: false,
        logging: configService.get('app.nodeEnv') === 'development',
        ssl: configService.get('database.ssl'),
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): ThrottlerModuleOptions => ({
        throttlers: [
          {
            ttl: configService.get('app.rateLimitTtl') || 60,
            limit: configService.get('app.rateLimitMax') || 100,
          },
        ],
      }),
      inject: [ConfigService],
    }),
    TerminusModule,
    MerchantsModule,
    PaymentsModule,
    PaymentMethodsModule,
    WebhooksModule,
    EventsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
