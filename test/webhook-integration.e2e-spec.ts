import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import * as crypto from 'crypto';
import * as express from 'express';
import { AppModule } from './../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
import { CorrelationIdInterceptor } from '../src/common/interceptors/correlation-id.interceptor';
import { PaymentStatus } from '../src/modules/payments/entities/payment.entity';

describe('Webhook Integration (e2e)', () => {
  let app: INestApplication<App>;
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

    // Set up test merchant and payment method
    const timestamp = Date.now();
    const merchantResponse = await request(app.getHttpServer())
      .post('/api/v1/merchants')
      .send({
        name: 'Webhook Test Merchant',
        email: `webhook-${timestamp}@test.com`,
        webhookUrl: 'https://api.webhooktest.com/webhooks',
      });

    merchant = merchantResponse.body.data;
    apiKey = merchant.apiKey;

    const paymentMethodResponse = await request(app.getHttpServer())
      .post('/api/v1/payment-methods')
      .set('X-API-Key', apiKey)
      .send({
        type: 'card',
        provider: 'Paystack',
        lastFour: '1234',
      });

    paymentMethod = paymentMethodResponse.body.data;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Webhook Signature Validation', () => {
    const webhookSecret = 'test-webhook-secret';

    beforeAll(() => {
      process.env.WEBHOOK_SECRET = webhookSecret;
    });

    afterAll(() => {
      delete process.env.WEBHOOK_SECRET;
    });

    it('should validate webhook signature correctly', async () => {
      // First create a payment to process
      const paymentResponse = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', apiKey)
        .send({
          amount: 1000,
          currency: 'NGN',
          paymentMethodId: paymentMethod.id,
          metadata: { testWebhook: true },
        });

      const payment = paymentResponse.body.data;

      const payload = {
        reference: payment.reference,
        status: PaymentStatus.COMPLETED,
        gatewayReference: 'gateway-ref-123',
      };

      const payloadString = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payloadString)
        .digest('hex');

      const response = await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment-gateway')
        .set('X-Webhook-Signature', signature)
        .send(payload)
        .expect(200);

      expect(response.body.data.success).toBe(true);
    });

    it('should reject webhook with invalid signature', async () => {
      const payload = {
        reference: 'PAY-INVALID-SIGNATURE',
        status: PaymentStatus.COMPLETED,
      };

      const invalidSignature = 'invalid-signature';

      await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment-gateway')
        .set('X-Webhook-Signature', invalidSignature)
        .send(payload)
        .expect(400);
    });

    it('should reject webhook with tampered payload', async () => {
      const originalPayload = {
        reference: 'PAY-ORIGINAL',
        status: PaymentStatus.COMPLETED,
      };

      const originalSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(originalPayload))
        .digest('hex');

      const tamperedPayload = {
        reference: 'PAY-TAMPERED',
        status: PaymentStatus.COMPLETED,
      };

      await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment-gateway')
        .set('X-Webhook-Signature', originalSignature)
        .send(tamperedPayload)
        .expect(400);
    });

    it('should process webhook without signature when signature is optional', async () => {
      // Create a payment
      const paymentResponse = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', apiKey)
        .send({
          amount: 1000,
          currency: 'NGN',
          paymentMethodId: paymentMethod.id,
        });

      const payment = paymentResponse.body.data;

      // Process webhook without signature
      const response = await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment-gateway')
        .send({
          reference: payment.reference,
          status: PaymentStatus.COMPLETED,
          gatewayReference: 'gateway-ref-no-signature',
        })
        .expect(200);

      expect(response.body.data.success).toBe(true);
    });
  });

  describe('Payment Status Updates via Webhooks', () => {
    it('should process payment completion webhook', async () => {
      // Create a payment
      const paymentResponse = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', apiKey)
        .send({
          amount: 25000,
          currency: 'NGN',
          paymentMethodId: paymentMethod.id,
          metadata: { orderId: 'ORDER-COMPLETE-TEST' },
        });

      const payment = paymentResponse.body.data;
      expect(payment.status).toBe(PaymentStatus.PENDING);

      // Process completion webhook
      const webhookResponse = await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment-gateway')
        .send({
          reference: payment.reference,
          status: PaymentStatus.COMPLETED,
          gatewayReference: 'gateway-complete-123',
          metadata: {
            processor: 'paystack',
            transactionId: 'txn_complete_123',
            fees: 125,
          },
        })
        .expect(200);

      expect(webhookResponse.body.data.success).toBe(true);

      // Verify payment status was updated
      const updatedPaymentResponse = await request(app.getHttpServer())
        .get(`/api/v1/payments/${payment.id}`)
        .set('X-API-Key', apiKey);

      const updatedPayment = updatedPaymentResponse.body.data;
      expect(updatedPayment.status).toBe(PaymentStatus.COMPLETED);
      expect(updatedPayment.gatewayReference).toBe('gateway-complete-123');
      expect(updatedPayment.completedAt).toBeDefined();
    });

    it('should process payment failure webhook', async () => {
      // Create a payment
      const paymentResponse = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', apiKey)
        .send({
          amount: 15000,
          currency: 'NGN',
          paymentMethodId: paymentMethod.id,
          metadata: { orderId: 'ORDER-FAIL-TEST' },
        });

      const payment = paymentResponse.body.data;

      // Process failure webhook
      const webhookResponse = await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment-gateway')
        .send({
          reference: payment.reference,
          status: PaymentStatus.FAILED,
          failureReason: 'Insufficient funds',
          metadata: {
            processor: 'paystack',
            errorCode: 'INSUFFICIENT_FUNDS',
            errorMessage: 'Account balance is too low',
          },
        })
        .expect(200);

      expect(webhookResponse.body.data.success).toBe(true);

      // Verify payment status was updated
      const updatedPaymentResponse = await request(app.getHttpServer())
        .get(`/api/v1/payments/${payment.id}`)
        .set('X-API-Key', apiKey);

      const updatedPayment = updatedPaymentResponse.body.data;
      expect(updatedPayment.status).toBe(PaymentStatus.FAILED);
      expect(updatedPayment.failureReason).toBe('Insufficient funds');
    });

    it('should process payment cancellation webhook', async () => {
      // Create a payment
      const paymentResponse = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', apiKey)
        .send({
          amount: 5000,
          currency: 'NGN',
          paymentMethodId: paymentMethod.id,
          metadata: { orderId: 'ORDER-CANCEL-TEST' },
        });

      const payment = paymentResponse.body.data;

      // Process cancellation webhook
      const webhookResponse = await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment-gateway')
        .send({
          reference: payment.reference,
          status: PaymentStatus.CANCELLED,
          metadata: {
            processor: 'paystack',
            reason: 'User cancelled transaction',
          },
        })
        .expect(200);

      expect(webhookResponse.body.data.success).toBe(true);

      // Verify payment status was updated
      const updatedPaymentResponse = await request(app.getHttpServer())
        .get(`/api/v1/payments/${payment.id}`)
        .set('X-API-Key', apiKey);

      const updatedPayment = updatedPaymentResponse.body.data;
      expect(updatedPayment.status).toBe(PaymentStatus.CANCELLED);
    });

    it('should process payment refund webhook', async () => {
      // First create and complete a payment
      const paymentResponse = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', apiKey)
        .send({
          amount: 10000,
          currency: 'NGN',
          paymentMethodId: paymentMethod.id,
          metadata: { orderId: 'ORDER-REFUND-TEST' },
        });

      const payment = paymentResponse.body.data;

      // Complete the payment
      await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment-gateway')
        .send({
          reference: payment.reference,
          status: PaymentStatus.COMPLETED,
          gatewayReference: 'gateway-refund-123',
        });

      // Process refund webhook
      const webhookResponse = await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment-gateway')
        .send({
          reference: payment.reference,
          status: PaymentStatus.REFUNDED,
          gatewayReference: 'refund-ref-123',
          metadata: {
            processor: 'paystack',
            refundAmount: 10000,
            refundReason: 'Customer requested refund',
          },
        })
        .expect(200);

      expect(webhookResponse.body.data.success).toBe(true);

      // Verify payment status was updated
      const updatedPaymentResponse = await request(app.getHttpServer())
        .get(`/api/v1/payments/${payment.id}`)
        .set('X-API-Key', apiKey);

      const updatedPayment = updatedPaymentResponse.body.data;
      expect(updatedPayment.status).toBe(PaymentStatus.REFUNDED);
    });
  });

  describe('Webhook Idempotency and Error Handling', () => {
    it('should handle duplicate webhook processing idempotently', async () => {
      // Create a payment
      const paymentResponse = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', apiKey)
        .send({
          amount: 1000,
          currency: 'NGN',
          paymentMethodId: paymentMethod.id,
          metadata: { orderId: 'ORDER-IDEMPOTENT-TEST' },
        });

      const payment = paymentResponse.body.data;

      // Process the same webhook multiple times
      const webhookPayload = {
        reference: payment.reference,
        status: PaymentStatus.COMPLETED,
        gatewayReference: 'gateway-idempotent-123',
      };

      const response1 = await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment-gateway')
        .send(webhookPayload)
        .expect(200);

      const response2 = await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment-gateway')
        .send(webhookPayload)
        .expect(200);

      expect(response1.body.data.success).toBe(true);
      expect(response2.body.data.success).toBe(true);

      // Both should succeed without changing the payment status multiple times
    });

    it('should handle webhook for non-existent payment', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment-gateway')
        .send({
          reference: 'PAY-NON-EXISTENT-123',
          status: PaymentStatus.COMPLETED,
        })
        .expect(404);
    });

    it('should handle webhook for already processed payment gracefully', async () => {
      // Create a payment
      const paymentResponse = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', apiKey)
        .send({
          amount: 1000,
          currency: 'NGN',
          paymentMethodId: paymentMethod.id,
        });

      const payment = paymentResponse.body.data;

      // Complete the payment
      await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment-gateway')
        .send({
          reference: payment.reference,
          status: PaymentStatus.COMPLETED,
        });

      // Try to process a different status webhook (should be handled gracefully)
      const response = await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment-gateway')
        .send({
          reference: payment.reference,
          status: PaymentStatus.FAILED,
          failureReason: 'Attempt to fail completed payment',
        })
        .expect(200);

      expect(response.body.data.success).toBe(true);
    });

    it('should validate webhook payload structure', async () => {
      // Test missing required fields
      await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment-gateway')
        .send({
          status: PaymentStatus.COMPLETED,
        })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment-gateway')
        .send({
          reference: 'PAY-TEST',
        })
        .expect(400);

      // Test invalid status
      await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment-gateway')
        .send({
          reference: 'PAY-TEST',
          status: 'invalid-status',
        })
        .expect(400);
    });

    it('should handle malformed webhook payloads', async () => {
      // Test with invalid JSON structure
      await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment-gateway')
        .send('invalid-json')
        .expect(400);

      // Test with null values
      await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment-gateway')
        .send({
          reference: null,
          status: PaymentStatus.COMPLETED,
        })
        .expect(400);
    });
  });

  describe('Webhook Security and Performance', () => {
    it('should handle large webhook payloads', async () => {
      // Create a payment
      const paymentResponse = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', apiKey)
        .send({
          amount: 1000,
          currency: 'NGN',
          paymentMethodId: paymentMethod.id,
        });

      const payment = paymentResponse.body.data;

      // Create large metadata
      const largeMetadata = {
        data: 'x'.repeat(100000),
        nested: {
          key: 'value',
          array: Array(1000).fill({ item: 'data' }),
        },
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment-gateway')
        .send({
          reference: payment.reference,
          status: PaymentStatus.COMPLETED,
          gatewayReference: 'gateway-large-payload',
          metadata: largeMetadata,
        })
        .expect(200);

      expect(response.body.data.success).toBe(true);
    });

    it('should handle concurrent webhook processing', async () => {
      // Create multiple payments
      const payments: any[] = [];
      for (let i = 0; i < 5; i++) {
        const paymentResponse = await request(app.getHttpServer())
          .post('/api/v1/payments')
          .set('X-API-Key', apiKey)
          .send({
            amount: 1000 + i,
            currency: 'NGN',
            paymentMethodId: paymentMethod.id,
            metadata: { orderId: `ORDER-CONCURRENT-${i}` },
          });

        payments.push(paymentResponse.body.data);
      }

      // Process webhooks concurrently
      const webhookPromises = payments.map((payment, index) =>
        request(app.getHttpServer())
          .post('/api/v1/webhooks/payment-gateway')
          .send({
            reference: payment.reference,
            status: PaymentStatus.COMPLETED,
            gatewayReference: `gateway-concurrent-${index}`,
          })
      );

      const responses = await Promise.all(webhookPromises);

      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.data.success).toBe(true);
      });

      // Verify all payments were processed
      for (const payment of payments) {
        const updatedPaymentResponse = await request(app.getHttpServer())
          .get(`/api/v1/payments/${payment.id}`)
          .set('X-API-Key', apiKey);

        const updatedPayment = updatedPaymentResponse.body.data;
        expect(updatedPayment.status).toBe(PaymentStatus.COMPLETED);
      }
    });

    it('should handle malicious webhook payloads', async () => {
      // Test with SQL injection attempts
      const maliciousPayload = {
        reference: "'; DROP TABLE payments; --",
        status: PaymentStatus.COMPLETED,
      };

      await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment-gateway')
        .send(maliciousPayload)
        .expect(404); // Should not find the payment, not crash

      // Test with XSS attempts
      const xssPayload = {
        reference: 'PAY-XSS-TEST',
        status: PaymentStatus.COMPLETED,
        metadata: {
          script: '<script>alert("xss")</script>',
          html: '<img src="x" onerror="alert(1)">',
        },
      };

      // Create a payment first
      const paymentResponse = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', apiKey)
        .send({
          amount: 1000,
          currency: 'NGN',
          paymentMethodId: paymentMethod.id,
        });

      const payment = paymentResponse.body.data;
      xssPayload.reference = payment.reference;

      const response = await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment-gateway')
        .send(xssPayload)
        .expect(200);

      expect(response.body.data.success).toBe(true);
    });
  });
});
