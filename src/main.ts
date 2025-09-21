import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as express from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { CorrelationIdInterceptor } from './common/interceptors/correlation-id.interceptor';
import { ApiKeyGuard } from './common/guards/api-key.guard';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    bodyParser: true,
    rawBody: false,
  });
  const configService = app.get(ConfigService);

  // Increase body parser limit for large webhook payloads
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  app.use(helmet());

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
    ],
    credentials: true,
  });

  const apiPrefix = configService.get('app.apiPrefix') || 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(
    new CorrelationIdInterceptor(),
    new LoggingInterceptor(),
  );

  // Apply API key guard globally, but exclude health and docs endpoints
  const apiKeyGuard = app.get(ApiKeyGuard);
  app.useGlobalGuards(apiKeyGuard);

  const config = new DocumentBuilder()
    .setTitle('Payment System API')
    .setDescription(
      'High-performance payment processing system for Nigerian market with AWS SQS integration',
    )
    .setVersion('1.0')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-API-Key',
        in: 'header',
      },
      'api-key',
    )
    .addTag('merchants', 'Merchant management')
    .addTag('payments', 'Payment processing')
    .addTag('payment-methods', 'Payment method management')
    .addTag('webhooks', 'Webhook handling')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

  const port = configService.get('app.port') || 3000;
  await app.listen(port);

  logger.log(`🚀 Application is running on: http://localhost:${port}/${apiPrefix}`);
  logger.log(`📚 API Documentation: http://localhost:${port}/${apiPrefix}/docs`);
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
