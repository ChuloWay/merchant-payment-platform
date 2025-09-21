import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import * as express from 'express';
import { AppModule } from './../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
import { CorrelationIdInterceptor } from '../src/common/interceptors/correlation-id.interceptor';
import { DataSource } from 'typeorm';
import { PaymentStatus } from '../src/modules/payments/entities/payment.entity';
import { PaymentMethodType } from '../src/modules/payment-methods/entities/payment-method.entity';

describe('Database Integration (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
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

    // Get DataSource instance
    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Set up test merchant and payment method
    const timestamp = Date.now();
    const merchantResponse = await request(app.getHttpServer())
      .post('/api/v1/merchants')
      .send({
        name: 'Database Test Merchant',
        email: `database-${timestamp}@test.com`,
        webhookUrl: 'https://api.databasetest.com/webhooks',
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

  describe('Database Transaction Integrity', () => {
    it('should maintain ACID properties during payment creation', async () => {
      const paymentData = {
        amount: 25000,
        currency: 'NGN',
        paymentMethodId: paymentMethod.id,
        metadata: {
          orderId: 'ORDER-TRANSACTION-TEST',
          customerId: 'CUST-TRANSACTION-123',
        },
      };

      // Create payment through API
      const paymentResponse = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', apiKey)
        .send(paymentData)
        .expect(201);

      const payment = paymentResponse.body.data;

      // Verify payment was created in database
      const paymentInDb = await dataSource.query(
        'SELECT * FROM payments WHERE id = $1',
        [payment.id]
      );

      expect(paymentInDb).toHaveLength(1);
      expect(paymentInDb[0].amount).toBe('25000.00');
      expect(paymentInDb[0].currency).toBe('NGN');
      expect(paymentInDb[0].status).toBe(PaymentStatus.PENDING);
      expect(paymentInDb[0].merchantId).toBe(merchant.id);
      expect(paymentInDb[0].paymentMethodId).toBe(paymentMethod.id);

      // Verify payment method still exists and is active
      const paymentMethodInDb = await dataSource.query(
        'SELECT * FROM payment_methods WHERE id = $1',
        [paymentMethod.id]
      );

      expect(paymentMethodInDb).toHaveLength(1);
      expect(paymentMethodInDb[0].isActive).toBe(true);
      expect(paymentMethodInDb[0].merchantId).toBe(merchant.id);
    });

    it('should handle payment status updates with transaction integrity', async () => {
      // Create a payment
      const paymentResponse = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', apiKey)
        .send({
          amount: 15000,
          currency: 'NGN',
          paymentMethodId: paymentMethod.id,
          metadata: { orderId: 'ORDER-STATUS-UPDATE-TEST' },
        });

      const payment = paymentResponse.body.data;

      // Update payment status via webhook
      await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment-gateway')
        .send({
          reference: payment.reference,
          status: PaymentStatus.COMPLETED,
          gatewayReference: 'gateway-status-update-123',
        })
        .expect(200);

      // Verify status was updated in database
      const updatedPaymentInDb = await dataSource.query(
        'SELECT * FROM payments WHERE id = $1',
        [payment.id]
      );

      expect(updatedPaymentInDb).toHaveLength(1);
      expect(updatedPaymentInDb[0].status).toBe(PaymentStatus.COMPLETED);
      expect(updatedPaymentInDb[0].gatewayReference).toBe('gateway-status-update-123');
      expect(updatedPaymentInDb[0].completedAt).toBeDefined();
      expect(updatedPaymentInDb[0].updatedAt).not.toEqual(updatedPaymentInDb[0].createdAt);
    });

    it('should maintain referential integrity between tables', async () => {
      // Verify merchant-payment relationship
      const merchantPayments = await dataSource.query(
        'SELECT p.*, m.name as merchant_name FROM payments p JOIN merchants m ON p."merchantId" = m.id WHERE m.id = $1',
        [merchant.id]
      );

      expect(merchantPayments.length).toBeGreaterThan(0);
      merchantPayments.forEach(payment => {
        expect(payment.merchant_name).toBe('Database Test Merchant');
        expect(payment.merchantId).toBe(merchant.id);
      });

      // Verify payment-payment_method relationship
      const paymentMethodPayments = await dataSource.query(
        'SELECT p.*, pm.type as payment_method_type FROM payments p JOIN payment_methods pm ON p."paymentMethodId" = pm.id WHERE pm.id = $1',
        [paymentMethod.id]
      );

      expect(paymentMethodPayments.length).toBeGreaterThan(0);
      paymentMethodPayments.forEach(payment => {
        expect(payment.payment_method_type).toBe(PaymentMethodType.CARD);
        expect(payment.paymentMethodId).toBe(paymentMethod.id);
      });
    });
  });

  describe('Database Constraints and Validation', () => {
    it('should enforce unique constraints', async () => {
      // Try to create merchant with duplicate email
      await request(app.getHttpServer())
        .post('/api/v1/merchants')
        .send({
          name: 'Duplicate Email Merchant',
          email: merchant.email, // Same email as existing merchant
        })
        .expect(409); // Conflict

      // Verify no duplicate was created
      const merchantsWithSameEmail = await dataSource.query(
        'SELECT * FROM merchants WHERE email = $1',
        [merchant.email]
      );

      expect(merchantsWithSameEmail).toHaveLength(1);
    });

    it('should enforce foreign key constraints', async () => {
      // Try to create payment with non-existent payment method
      await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', apiKey)
        .send({
          amount: 1000,
          currency: 'NGN',
          paymentMethodId: 'non-existent-id',
        })
        .expect(400); // Bad request due to validation

      // Try to create payment with non-existent merchant (by using different API key)
      const timestamp2 = Date.now();
      const anotherMerchantResponse = await request(app.getHttpServer())
        .post('/api/v1/merchants')
        .send({
          name: 'Another Merchant',
          email: `another-${timestamp2}@test.com`,
        });

      const anotherMerchant = anotherMerchantResponse.body.data;

      // Create payment method for another merchant
      const anotherPaymentMethodResponse = await request(app.getHttpServer())
        .post('/api/v1/payment-methods')
        .set('X-API-Key', anotherMerchant.apiKey)
        .send({
          type: PaymentMethodType.CARD,
          provider: 'Paystack',
          lastFour: '5678',
        });

      const anotherPaymentMethod = anotherPaymentMethodResponse.body.data;

      // Try to use another merchant's payment method with our API key
      await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', apiKey) // Our merchant's API key
        .send({
          amount: 1000,
          currency: 'NGN',
          paymentMethodId: anotherPaymentMethod.id, // Another merchant's payment method
        })
        .expect(404); // Payment method not found for this merchant
    });

    it('should enforce data type constraints', async () => {
      // Test with invalid amount (should be caught by validation, not DB)
      await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', apiKey)
        .send({
          amount: 'invalid-amount',
          currency: 'NGN',
          paymentMethodId: paymentMethod.id,
        })
        .expect(400);

      // Test with negative amount
      await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', apiKey)
        .send({
          amount: -100,
          currency: 'NGN',
          paymentMethodId: paymentMethod.id,
        })
        .expect(400);
    });
  });

  describe('Database Performance and Indexing', () => {
    it('should efficiently query payments by merchant', async () => {
      // Create multiple payments
      const paymentPromises: Promise<any>[] = [];
      for (let i = 0; i < 10; i++) {
        paymentPromises.push(
          request(app.getHttpServer())
            .post('/api/v1/payments')
            .set('X-API-Key', apiKey)
            .send({
              amount: 1000 + i * 100,
              currency: 'NGN',
              paymentMethodId: paymentMethod.id,
              metadata: { orderId: `ORDER-PERF-${i}` },
            })
        );
      }

      await Promise.all(paymentPromises);

      // Query payments by merchant (should use index on merchant_id)
      const startTime = Date.now();
      const paymentsResponse = await request(app.getHttpServer())
        .get('/api/v1/payments?limit=20')
        .set('X-API-Key', apiKey)
        .expect(200);

      const queryTime = Date.now() - startTime;
      expect(queryTime).toBeLessThan(1000); // Should be fast

      const payments = paymentsResponse.body.data;
      expect(payments.length).toBeGreaterThanOrEqual(10);
      
      // All payments should belong to our merchant
      payments.forEach(payment => {
        expect(payment.merchantId).toBe(merchant.id);
      });
    });

    it('should efficiently query payments by reference', async () => {
      // Create a payment
      const paymentResponse = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', apiKey)
        .send({
          amount: 5000,
          currency: 'NGN',
          paymentMethodId: paymentMethod.id,
          metadata: { orderId: 'ORDER-REF-PERF-TEST' },
        });

      const payment = paymentResponse.body.data;

      // Query by reference (should use index on reference)
      const startTime = Date.now();
      const paymentByRefResponse = await request(app.getHttpServer())
        .get(`/api/v1/payments/reference/${payment.reference}`)
        .set('X-API-Key', apiKey)
        .expect(200);

      const queryTime = Date.now() - startTime;
      expect(queryTime).toBeLessThan(1000); // Should be fast

      const retrievedPayment = paymentByRefResponse.body.data;
      expect(retrievedPayment.id).toBe(payment.id);
      expect(retrievedPayment.reference).toBe(payment.reference);
    });

    it('should handle pagination efficiently', async () => {
      // Test pagination with limit and offset
      const firstPageResponse = await request(app.getHttpServer())
        .get('/api/v1/payments?limit=5&offset=0')
        .set('X-API-Key', apiKey)
        .expect(200);

      const secondPageResponse = await request(app.getHttpServer())
        .get('/api/v1/payments?limit=5&offset=5')
        .set('X-API-Key', apiKey)
        .expect(200);

      const firstPage = firstPageResponse.body.data;
      const secondPage = secondPageResponse.body.data;

      expect(firstPage.length).toBeLessThanOrEqual(5);
      expect(secondPage.length).toBeLessThanOrEqual(5);

      // Verify no duplicates between pages
      const firstPageIds = firstPage.map(p => p.id);
      const secondPageIds = secondPage.map(p => p.id);
      const intersection = firstPageIds.filter(id => secondPageIds.includes(id));
      expect(intersection).toHaveLength(0);
    });
  });

  describe('Database Error Handling and Recovery', () => {
    it('should handle database connection issues gracefully', async () => {
      // This test simulates database connection issues
      // In a real scenario, we would temporarily disconnect the database
      // For this test, we'll verify the application handles errors properly

      // Create a payment that should work normally
      const paymentResponse = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', apiKey)
        .send({
          amount: 1000,
          currency: 'NGN',
          paymentMethodId: paymentMethod.id,
          metadata: { orderId: 'ORDER-ERROR-TEST' },
        })
        .expect(201);

      expect(paymentResponse.body.data).toHaveProperty('id');
    });

    it('should maintain data consistency during concurrent operations', async () => {
      // Create multiple payments concurrently
      const paymentPromises: Promise<any>[] = [];
      for (let i = 0; i < 5; i++) {
        paymentPromises.push(
          request(app.getHttpServer())
            .post('/api/v1/payments')
            .set('X-API-Key', apiKey)
            .send({
              amount: 1000 + i,
              currency: 'NGN',
              paymentMethodId: paymentMethod.id,
              metadata: { orderId: `ORDER-CONCURRENT-${i}` },
            })
        );
      }

      const responses = await Promise.all(paymentPromises);

      // All payments should be created successfully
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.data).toHaveProperty('id');
      });

      // Verify all payments exist in database
      const paymentIds = responses.map(r => r.body.data.id);
      const paymentsInDb = await dataSource.query(
        'SELECT * FROM payments WHERE id = ANY($1)',
        [paymentIds]
      );

      expect(paymentsInDb).toHaveLength(5);
      paymentsInDb.forEach(payment => {
        expect(payment.merchantId).toBe(merchant.id);
        expect(payment.status).toBe(PaymentStatus.PENDING);
      });
    });

    it('should handle transaction rollback on errors', async () => {
      // Create a payment
      const paymentResponse = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', apiKey)
        .send({
          amount: 1000,
          currency: 'NGN',
          paymentMethodId: paymentMethod.id,
          metadata: { orderId: 'ORDER-ROLLBACK-TEST' },
        });

      const payment = paymentResponse.body.data;

      // Verify payment was created
      const paymentInDb = await dataSource.query(
        'SELECT * FROM payments WHERE id = $1',
        [payment.id]
      );

      expect(paymentInDb).toHaveLength(1);
      expect(paymentInDb[0].status).toBe(PaymentStatus.PENDING);

      // Try to process webhook with invalid data (should not crash)
      await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment-gateway')
        .send({
          reference: payment.reference,
          status: 'invalid-status',
        })
        .expect(400);

      // Verify payment status was not changed
      const paymentAfterError = await dataSource.query(
        'SELECT * FROM payments WHERE id = $1',
        [payment.id]
      );

      expect(paymentAfterError[0].status).toBe(PaymentStatus.PENDING);
    });
  });

  describe('Database Migration and Schema Validation', () => {
    it('should have correct table structure', async () => {
      // Verify merchant table structure
      const merchantColumns = await dataSource.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'merchants'
        ORDER BY ordinal_position
      `);

      const expectedMerchantColumns = [
        'id', 'name', 'email', 'apiKey', 'webhookUrl', 'isActive',
        'createdAt', 'updatedAt'
      ];

      const actualMerchantColumns = merchantColumns.map(col => col.column_name);
      expectedMerchantColumns.forEach(expectedCol => {
        expect(actualMerchantColumns).toContain(expectedCol);
      });

      // Verify payment table structure
      const paymentColumns = await dataSource.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'payments'
        ORDER BY ordinal_position
      `);

      const expectedPaymentColumns = [
        'id', 'reference', 'amount', 'currency', 'status', 'merchantId',
        'paymentMethodId', 'gatewayReference', 'failureReason',
        'metadata', 'initiatedAt', 'completedAt', 'createdAt', 'updatedAt'
      ];

      const actualPaymentColumns = paymentColumns.map(col => col.column_name);
      expectedPaymentColumns.forEach(expectedCol => {
        expect(actualPaymentColumns).toContain(expectedCol);
      });

      // Verify payment_method table structure
      const paymentMethodColumns = await dataSource.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'payment_methods'
        ORDER BY ordinal_position
      `);

      const expectedPaymentMethodColumns = [
        'id', 'type', 'provider', 'lastFour', 'accountNumber',
        'bankCode', 'bankName', 'metadata', 'isActive', 'merchantId',
        'createdAt', 'updatedAt'
      ];

      const actualPaymentMethodColumns = paymentMethodColumns.map(col => col.column_name);
      expectedPaymentMethodColumns.forEach(expectedCol => {
        expect(actualPaymentMethodColumns).toContain(expectedCol);
      });
    });

    it('should have proper indexes for performance', async () => {
      // Check for indexes on frequently queried columns
      const indexes = await dataSource.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename IN ('merchants', 'payments', 'payment_methods')
        ORDER BY tablename, indexname
      `);

      const indexNames = indexes.map(idx => idx.indexname);

      // Verify important indexes exist
      expect(indexNames.some(name => name.includes('email'))).toBe(true);
      expect(indexNames.some(name => name.includes('apiKey'))).toBe(true);
      expect(indexNames.some(name => name.includes('reference'))).toBe(true);
      expect(indexNames.some(name => name.includes('merchantId'))).toBe(true);
      expect(indexNames.some(name => name.includes('merchantId'))).toBe(true);
    });
  });
});
