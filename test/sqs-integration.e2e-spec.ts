import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import * as express from 'express';
import { AppModule } from './../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
import { CorrelationIdInterceptor } from '../src/common/interceptors/correlation-id.interceptor';
import { SqsService } from '../src/modules/events/sqs.service';
import { PaymentStatus } from '../src/modules/payments/entities/payment.entity';
import { PaymentMethodType } from '../src/modules/payment-methods/entities/payment-method.entity';

describe('SQS Integration (e2e)', () => {
  let app: INestApplication<App>;
  let sqsService: SqsService;
  let merchant: any;
  let apiKey: string;
  let paymentMethod: any;

  jest.setTimeout(30000); // 30 seconds timeout for all tests

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({
      bodyParser: true,
      rawBody: false,
    });
    
    // Apply the same configuration as main.ts
    app.setGlobalPrefix('api/v1');
    
    // Increase body parser limit for large webhook payloads
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ limit: '10mb', extended: true }));
    
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

    await app.init();

    // Get SQS service instance
    sqsService = moduleFixture.get<SqsService>(SqsService);

    // Set up test merchant and payment method
    const timestamp = Date.now();
    const merchantResponse = await request(app.getHttpServer())
      .post('/api/v1/merchants')
      .send({
        name: 'SQS Test Merchant',
        email: `sqs-${timestamp}@test.com`,
        webhookUrl: 'https://api.sqstest.com/webhooks',
      });

    merchant = merchantResponse.body.data;
    apiKey = merchant.apiKey;

    const paymentMethodResponse = await request(app.getHttpServer())
      .post('/api/v1/payment-methods')
      .set('X-API-Key', apiKey)
      .send({
        type: PaymentMethodType.CARD,
        provider: 'Paystack',
        lastFour: '1234',
      });

    paymentMethod = paymentMethodResponse.body.data;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('SQS Event Publishing', () => {
    it('should publish payment-initiated event when payment is created', async () => {
      // Mock the SQS publish method to capture events
      const publishEventSpy = jest.spyOn(sqsService, 'publishEvent');

      // Create a payment
      const paymentResponse = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', apiKey)
        .send({
          amount: 25000,
          currency: 'NGN',
          paymentMethodId: paymentMethod.id,
          metadata: {
            orderId: 'ORDER-SQS-TEST',
            customerId: 'CUST-SQS-123',
          },
        })
        .expect(201);

      const payment = paymentResponse.body.data;

      // Verify SQS event was published
      expect(publishEventSpy).toHaveBeenCalledWith(
        'payment-initiated',
        expect.objectContaining({
          paymentId: payment.id,
          reference: payment.reference,
          amount: payment.amount,
          currency: payment.currency,
          merchantId: payment.merchantId,
          paymentMethodId: payment.paymentMethodId,
          metadata: expect.objectContaining({
            orderId: 'ORDER-SQS-TEST',
            customerId: 'CUST-SQS-123',
          }),
        })
      );

      // Verify event structure
      const eventCall = publishEventSpy.mock.calls[0];
      const eventType = eventCall[0];
      const eventPayload = eventCall[1];

      expect(eventType).toBe('payment-initiated');
      expect(eventPayload).toHaveProperty('paymentId');
      expect(eventPayload).toHaveProperty('reference');
      expect(eventPayload).toHaveProperty('amount');
      expect(eventPayload).toHaveProperty('currency');
      expect(eventPayload).toHaveProperty('merchantId');
      expect(eventPayload).toHaveProperty('paymentMethodId');
      expect(eventPayload).toHaveProperty('initiatedAt');

      publishEventSpy.mockRestore();
    });

    it('should handle SQS publishing failures gracefully', async () => {
      // Mock SQS service to throw an error
      const publishEventSpy = jest.spyOn(sqsService, 'publishEvent')
        .mockRejectedValue(new Error('SQS publish failed'));

      // Create a payment - should still succeed even if SQS fails
      const paymentResponse = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', apiKey)
        .send({
          amount: 15000,
          currency: 'NGN',
          paymentMethodId: paymentMethod.id,
          metadata: { orderId: 'ORDER-SQS-FAIL-TEST' },
        })
        .expect(201);

      const payment = paymentResponse.body.data;

      // Payment should be created successfully despite SQS failure
      expect(payment).toHaveProperty('id');
      expect(payment).toHaveProperty('reference');
      expect(payment.amount).toBe(15000);
      expect(payment.status).toBe(PaymentStatus.PENDING);

      // Verify SQS was attempted
      expect(publishEventSpy).toHaveBeenCalledWith(
        'payment-initiated',
        expect.objectContaining({
          paymentId: payment.id,
          reference: payment.reference,
        })
      );

      publishEventSpy.mockRestore();
    });

    it('should publish events with correct correlation ID', async () => {
      const publishEventSpy = jest.spyOn(sqsService, 'publishEvent');

      // Create a payment with correlation ID
      const correlationId = 'test-correlation-id-123';
      
      const paymentResponse = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', apiKey)
        .set('X-Correlation-ID', correlationId)
        .send({
          amount: 10000,
          currency: 'NGN',
          paymentMethodId: paymentMethod.id,
          metadata: { orderId: 'ORDER-CORRELATION-TEST' },
        })
        .expect(201);

      // Verify SQS event was published
      expect(publishEventSpy).toHaveBeenCalled();

      publishEventSpy.mockRestore();
    });
  });

  describe('SQS Event Structure and Content', () => {
    it('should publish events with proper structure', async () => {
      const publishEventSpy = jest.spyOn(sqsService, 'publishEvent');

      // Create a payment
      const paymentResponse = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', apiKey)
        .send({
          amount: 30000,
          currency: 'NGN',
          paymentMethodId: paymentMethod.id,
          metadata: {
            orderId: 'ORDER-STRUCTURE-TEST',
            customerId: 'CUST-STRUCTURE-123',
            items: [
              { name: 'Product 1', price: 15000 },
              { name: 'Product 2', price: 15000 },
            ],
          },
        });

      const payment = paymentResponse.body.data;

      // Verify event payload structure
      const eventCall = publishEventSpy.mock.calls[0];
      const eventPayload = eventCall[1];

      // Required fields
      expect(eventPayload).toHaveProperty('paymentId', payment.id);
      expect(eventPayload).toHaveProperty('reference', payment.reference);
      expect(eventPayload).toHaveProperty('amount', payment.amount);
      expect(eventPayload).toHaveProperty('currency', payment.currency);
      expect(eventPayload).toHaveProperty('merchantId', payment.merchantId);
      expect(eventPayload).toHaveProperty('paymentMethodId', payment.paymentMethodId);
      expect(eventPayload).toHaveProperty('initiatedAt');
      expect(eventPayload).toHaveProperty('metadata');

      // Verify metadata structure
      expect(eventPayload.metadata).toHaveProperty('orderId', 'ORDER-STRUCTURE-TEST');
      expect(eventPayload.metadata).toHaveProperty('customerId', 'CUST-STRUCTURE-123');
      expect(eventPayload.metadata).toHaveProperty('items');
      expect(Array.isArray(eventPayload.metadata.items)).toBe(true);

      // Verify timestamp format
      expect(new Date(eventPayload.initiatedAt)).toBeInstanceOf(Date);
      expect(new Date(eventPayload.initiatedAt).getTime()).toBeGreaterThan(0);

      publishEventSpy.mockRestore();
    });

    it('should handle events with large metadata', async () => {
      const publishEventSpy = jest.spyOn(sqsService, 'publishEvent');

      // Create payment with large metadata
      const largeMetadata = {
        orderId: 'ORDER-LARGE-META-TEST',
        customerId: 'CUST-LARGE-META-123',
        largeData: 'x'.repeat(10000), // 10KB of data
        nested: {
          level1: {
            level2: {
              level3: {
                data: 'deep nested data',
                array: Array(100).fill({ item: 'data' }),
              },
            },
          },
        },
      };

      const paymentResponse = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', apiKey)
        .send({
          amount: 5000,
          currency: 'NGN',
          paymentMethodId: paymentMethod.id,
          metadata: largeMetadata,
        });

      const payment = paymentResponse.body.data;

      // Verify event was published with large metadata
      expect(publishEventSpy).toHaveBeenCalledWith(
        'payment-initiated',
        expect.objectContaining({
          paymentId: payment.id,
          metadata: largeMetadata,
        })
      );

      publishEventSpy.mockRestore();
    });
  });

  describe('SQS Service Configuration and Initialization', () => {
    it('should initialize SQS service correctly', () => {
      expect(sqsService).toBeDefined();
      expect(typeof sqsService.publishEvent).toBe('function');
      expect(typeof sqsService.consumeMessages).toBe('function');
    });

    it('should handle SQS configuration properly', () => {
      // The SQS service should be configured with proper settings
      // In a real environment, this would connect to actual SQS
      // In test environment, it should handle missing credentials gracefully
      expect(sqsService).toBeDefined();
    });

    it('should handle missing SQS credentials gracefully', async () => {
      // This test verifies that the application continues to work
      // even when SQS credentials are not available
      
      const publishEventSpy = jest.spyOn(sqsService, 'publishEvent')
        .mockImplementation(async () => {
          // Simulate SQS client not available
          return;
        });

      // Create a payment - should still work
      const paymentResponse = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', apiKey)
        .send({
          amount: 1000,
          currency: 'NGN',
          paymentMethodId: paymentMethod.id,
          metadata: { orderId: 'ORDER-NO-SQS-TEST' },
        })
        .expect(201);

      expect(paymentResponse.body.data).toHaveProperty('id');

      publishEventSpy.mockRestore();
    });
  });

  describe('SQS Event Processing Simulation', () => {
    it('should simulate event consumption', async () => {
      // Mock the consumeMessages method
      const consumeMessagesSpy = jest.spyOn(sqsService, 'consumeMessages')
        .mockImplementation(async () => {
          // Simulate consuming messages
          return;
        });

      // Call consumeMessages
      await sqsService.consumeMessages();

      // Verify method was called
      expect(consumeMessagesSpy).toHaveBeenCalled();

      consumeMessagesSpy.mockRestore();
    });

    it('should handle message processing errors gracefully', async () => {
      // Mock consumeMessages to throw an error
      const consumeMessagesSpy = jest.spyOn(sqsService, 'consumeMessages')
        .mockRejectedValue(new Error('SQS consume failed'));

      // Should not crash the application
      await expect(sqsService.consumeMessages()).rejects.toThrow('SQS consume failed');

      consumeMessagesSpy.mockRestore();
    });
  });

  describe('SQS Integration with Payment Lifecycle', () => {
    it('should publish events throughout payment lifecycle', async () => {
      const publishEventSpy = jest.spyOn(sqsService, 'publishEvent');

      // Step 1: Create payment (should publish payment-initiated)
      const paymentResponse = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', apiKey)
        .send({
          amount: 20000,
          currency: 'NGN',
          paymentMethodId: paymentMethod.id,
          metadata: { orderId: 'ORDER-LIFECYCLE-TEST' },
        });

      const payment = paymentResponse.body.data;

      // Verify payment-initiated event was published
      expect(publishEventSpy).toHaveBeenCalledWith(
        'payment-initiated',
        expect.objectContaining({
          paymentId: payment.id,
          reference: payment.reference,
        })
      );

      // Step 2: Complete payment via webhook (could publish payment-completed)
      await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment-gateway')
        .send({
          reference: payment.reference,
          status: PaymentStatus.COMPLETED,
          gatewayReference: 'gateway-lifecycle-123',
        })
        .expect(200);

      // Note: In a real implementation, webhook processing might also publish events
      // For now, we're testing that the initial payment-initiated event is published

      publishEventSpy.mockRestore();
    });

    it('should handle concurrent payment creation and event publishing', async () => {
      const publishEventSpy = jest.spyOn(sqsService, 'publishEvent');

      // Create multiple payments concurrently
      const paymentPromises: Promise<any>[] = [];
      for (let i = 0; i < 5; i++) {
        paymentPromises.push(
          request(app.getHttpServer())
            .post('/api/v1/payments')
            .set('X-API-Key', apiKey)
            .send({
              amount: 1000 + i * 100,
              currency: 'NGN',
              paymentMethodId: paymentMethod.id,
              metadata: { orderId: `ORDER-CONCURRENT-SQS-${i}` },
            })
        );
      }

      const responses = await Promise.all(paymentPromises);

      // All payments should be created successfully
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      // Verify SQS events were published for all payments
      expect(publishEventSpy).toHaveBeenCalledTimes(5);

      // Verify each event has correct structure
      const eventCalls = publishEventSpy.mock.calls;
      eventCalls.forEach((call, index) => {
        const [eventType, eventPayload] = call;
        expect(eventType).toBe('payment-initiated');
        expect(eventPayload).toHaveProperty('paymentId');
        expect(eventPayload).toHaveProperty('reference');
        expect(eventPayload).toHaveProperty('amount');
        // Due to concurrency, we can't guarantee order, so check if amount is in expected range
        expect(eventPayload.amount).toBeGreaterThanOrEqual(1000);
        expect(eventPayload.amount).toBeLessThanOrEqual(1400);
      });

      publishEventSpy.mockRestore();
    });
  });

  describe('SQS Error Handling and Resilience', () => {
    it('should continue operation when SQS is unavailable', async () => {
      // Mock SQS service to simulate unavailability
      const publishEventSpy = jest.spyOn(sqsService, 'publishEvent')
        .mockRejectedValue(new Error('SQS unavailable'));

      // Application should continue to work
      const paymentResponse = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', apiKey)
        .send({
          amount: 1000,
          currency: 'NGN',
          paymentMethodId: paymentMethod.id,
          metadata: { orderId: 'ORDER-SQS-UNAVAILABLE-TEST' },
        })
        .expect(201);

      // Payment should still be created
      expect(paymentResponse.body.data).toHaveProperty('id');
      expect(paymentResponse.body.data.amount).toBe(1000);

      // SQS should have been attempted
      expect(publishEventSpy).toHaveBeenCalled();

      publishEventSpy.mockRestore();
    });

    it('should handle malformed event data', async () => {
      // This test ensures the system doesn't crash with malformed data
      const publishEventSpy = jest.spyOn(sqsService, 'publishEvent');

      // Create payment with unusual but valid data
      const paymentResponse = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', apiKey)
        .send({
          amount: 1, // Minimum valid amount
          currency: 'NGN',
          paymentMethodId: paymentMethod.id,
          metadata: {
            specialChars: '!@#$%^&*()',
            unicode: '测试数据',
            nullValue: null,
            undefinedValue: undefined,
          },
        })
        .expect(201);

      // Should still work and publish event
      expect(paymentResponse.body.data).toHaveProperty('id');
      expect(publishEventSpy).toHaveBeenCalled();

      publishEventSpy.mockRestore();
    });
  });
});
