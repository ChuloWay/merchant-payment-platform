import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import * as express from 'express';
import { AppModule } from './../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
import { CorrelationIdInterceptor } from '../src/common/interceptors/correlation-id.interceptor';
import { MerchantsService } from '../src/modules/merchants/merchants.service';
import { PaymentMethodsService } from '../src/modules/payment-methods/payment-methods.service';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { PaymentMethodType } from '../src/modules/payment-methods/entities/payment-method.entity';
import { PaymentStatus } from '../src/modules/payments/entities/payment.entity';
import { DataSource } from 'typeorm';

describe('Payment Flow Integration (e2e)', () => {
  let app: INestApplication<App>;
  let merchantsService: MerchantsService;
  let paymentMethodsService: PaymentMethodsService;
  let paymentsService: PaymentsService;
  let dataSource: DataSource;

  let merchant: any;
  let paymentMethod: any;
  let apiKey: string;

  jest.setTimeout(30000); // 30 seconds timeout for all tests

  // Helper function to clean up database
  async function cleanupDatabase() {
    try {
      await dataSource.query('DELETE FROM payments');
      await dataSource.query('DELETE FROM payment_methods');
      await dataSource.query('DELETE FROM merchants');
    } catch (error) {
      console.warn('Database cleanup warning:', error.message);
    }
  }

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

    // Get service instances
    merchantsService = moduleFixture.get<MerchantsService>(MerchantsService);
    paymentMethodsService = moduleFixture.get<PaymentMethodsService>(PaymentMethodsService);
    paymentsService = moduleFixture.get<PaymentsService>(PaymentsService);
    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Clean up any existing test data
    await cleanupDatabase();
  });

  afterEach(async () => {
    // Clean up test data after each test
    await cleanupDatabase();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Complete Payment Flow', () => {
    it('should create merchant, add payment method, initialize payment, and process webhook', async () => {
      // Step 1: Create a merchant
      const timestamp = Date.now();
      const merchantResponse = await request(app.getHttpServer())
        .post('/api/v1/merchants')
        .send({
          name: 'Lagos Tech Solutions Ltd',
          email: `contact-${timestamp}@lagostech.com.ng`,
          webhookUrl: 'https://api.lagostech.com.ng/webhooks/payments',
        })
        .expect(201);

      merchant = merchantResponse.body.data;
      apiKey = merchant.apiKey;

      expect(merchant).toHaveProperty('id');
      expect(merchant).toHaveProperty('apiKey');
      expect(merchant.name).toBe('Lagos Tech Solutions Ltd');
      expect(merchant.email).toBe(`contact-${timestamp}@lagostech.com.ng`);

      // Step 2: Create a payment method for the merchant
      const paymentMethodResponse = await request(app.getHttpServer())
        .post('/api/v1/payment-methods')
        .set('X-API-Key', apiKey)
        .send({
          type: PaymentMethodType.CARD,
          provider: 'Paystack',
          lastFour: '1234',
          metadata: {
            cardType: 'visa',
            expiryMonth: '12',
            expiryYear: '2025',
          },
        })
        .expect(201);

      paymentMethod = paymentMethodResponse.body.data;

      expect(paymentMethod).toHaveProperty('id');
      expect(paymentMethod.type).toBe(PaymentMethodType.CARD);
      expect(paymentMethod.provider).toBe('Paystack');
      expect(paymentMethod.lastFour).toBe('1234');

      // Step 3: Initialize a payment
      const paymentResponse = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', apiKey)
        .send({
          amount: 25000.0,
          currency: 'NGN',
          paymentMethodId: paymentMethod.id,
          metadata: {
            customerId: 'CUST-123456',
            customerName: 'Adebayo Ogunlesi',
            customerEmail: 'adebayo@example.com',
            customerPhone: '+2348012345678',
            orderId: 'ORDER-789012',
            description: 'Payment for Lagos Tech Solutions services',
          },
        })
        .expect(201);

      const payment = paymentResponse.body.data;

      expect(payment).toHaveProperty('id');
      expect(payment).toHaveProperty('reference');
      expect(payment.amount).toBe(25000.0);
      expect(payment.currency).toBe('NGN');
      expect(payment.status).toBe(PaymentStatus.PENDING);
      expect(payment.paymentMethodId).toBe(paymentMethod.id);
      expect(payment.metadata.orderId).toBe('ORDER-789012');

      // Step 4: Retrieve payment by ID
      const retrievedPaymentResponse = await request(app.getHttpServer())
        .get(`/api/v1/payments/${payment.id}`)
        .set('X-API-Key', apiKey)
        .expect(200);

      const retrievedPayment = retrievedPaymentResponse.body.data;
      expect(retrievedPayment.id).toBe(payment.id);
      expect(retrievedPayment.reference).toBe(payment.reference);

      // Step 5: Retrieve payment by reference
      const paymentByRefResponse = await request(app.getHttpServer())
        .get(`/api/v1/payments/reference/${payment.reference}`)
        .set('X-API-Key', apiKey)
        .expect(200);

      const paymentByRef = paymentByRefResponse.body.data;
      expect(paymentByRef.id).toBe(payment.id);
      expect(paymentByRef.reference).toBe(payment.reference);

      // Step 6: List merchant payments
      const paymentsListResponse = await request(app.getHttpServer())
        .get('/api/v1/payments?limit=10&offset=0')
        .set('X-API-Key', apiKey)
        .expect(200);

      const paymentsList = paymentsListResponse.body.data;
      expect(Array.isArray(paymentsList)).toBe(true);
      expect(paymentsList.length).toBeGreaterThan(0);
      expect(paymentsList[0].id).toBe(payment.id);

      // Step 7: Process webhook to complete payment
      const webhookResponse = await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment-gateway')
        .send({
          reference: payment.reference,
          status: PaymentStatus.COMPLETED,
          gatewayReference: 'paystack_ref_123456',
          metadata: {
            processor: 'paystack',
            transactionId: 'txn_123456',
          },
        })
        .expect(200);

      expect(webhookResponse.body.data.success).toBe(true);

      // Step 8: Verify payment status was updated
      const completedPaymentResponse = await request(app.getHttpServer())
        .get(`/api/v1/payments/${payment.id}`)
        .set('X-API-Key', apiKey)
        .expect(200);

      const completedPayment = completedPaymentResponse.body.data;
      expect(completedPayment.status).toBe(PaymentStatus.COMPLETED);
      expect(completedPayment.gatewayReference).toBe('paystack_ref_123456');
      expect(completedPayment.completedAt).toBeDefined();
    });

    it('should handle payment failure flow', async () => {
      // Create a new payment method for failure testing
      const paymentMethodResponse = await request(app.getHttpServer())
        .post('/api/v1/payment-methods')
        .set('X-API-Key', apiKey)
        .send({
          type: PaymentMethodType.BANK_ACCOUNT,
          provider: 'Paystack',
          accountNumber: '1234567890',
          bankCode: '058',
          bankName: 'GTBank',
        })
        .expect(201);

      const bankPaymentMethod = paymentMethodResponse.body.data;

      // Initialize a payment
      const paymentResponse = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', apiKey)
        .send({
          amount: 15000.0,
          currency: 'NGN',
          paymentMethodId: bankPaymentMethod.id,
          metadata: {
            customerId: 'CUST-789012',
            orderId: 'ORDER-FAIL-TEST',
          },
        })
        .expect(201);

      const payment = paymentResponse.body.data;

      // Process webhook to fail payment
      const webhookResponse = await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment-gateway')
        .send({
          reference: payment.reference,
          status: PaymentStatus.FAILED,
          failureReason: 'Insufficient funds',
          metadata: {
            processor: 'paystack',
            errorCode: 'INSUFFICIENT_FUNDS',
          },
        })
        .expect(200);

      expect(webhookResponse.body.data.success).toBe(true);

      // Verify payment status was updated to failed
      const failedPaymentResponse = await request(app.getHttpServer())
        .get(`/api/v1/payments/${payment.id}`)
        .set('X-API-Key', apiKey)
        .expect(200);

      const failedPayment = failedPaymentResponse.body.data;
      expect(failedPayment.status).toBe(PaymentStatus.FAILED);
      expect(failedPayment.failureReason).toBe('Insufficient funds');
    });

    it('should handle payment cancellation flow', async () => {
      // Create merchant and payment method for this test
      const timestamp = Date.now();
      const merchantResponse = await request(app.getHttpServer())
        .post('/api/v1/merchants')
        .send({
          name: 'Cancel Test Merchant',
          email: `cancel-${timestamp}@test.com`,
          webhookUrl: 'https://api.canceltest.com/webhooks',
        })
        .expect(201);

      const testMerchant = merchantResponse.body.data;
      const testApiKey = testMerchant.apiKey;

      const paymentMethodResponse = await request(app.getHttpServer())
        .post('/api/v1/payment-methods')
        .set('X-API-Key', testApiKey)
        .send({
          type: PaymentMethodType.CARD,
          lastFour: '1111',
          metadata: {
            cardNumber: '4111111111111111',
            expiryMonth: '12',
            expiryYear: '2025',
            cvv: '123',
            cardholderName: 'Cancel Test User',
          },
        })
        .expect(201);

      const testPaymentMethod = paymentMethodResponse.body.data;

      // Initialize a payment
      const paymentResponse = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', testApiKey)
        .send({
          amount: 5000.0,
          currency: 'NGN',
          paymentMethodId: testPaymentMethod.id,
          metadata: {
            customerId: 'CUST-CANCEL-TEST',
            orderId: 'ORDER-CANCEL-TEST',
          },
        })
        .expect(201);

      const payment = paymentResponse.body.data;

      // Process webhook to cancel payment
      const webhookResponse = await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment-gateway')
        .send({
          reference: payment.reference,
          status: PaymentStatus.CANCELLED,
          metadata: {
            processor: 'paystack',
            reason: 'User cancelled',
          },
        })
        .expect(200);

      expect(webhookResponse.body.data.success).toBe(true);

      // Verify payment status was updated to cancelled
      const cancelledPaymentResponse = await request(app.getHttpServer())
        .get(`/api/v1/payments/${payment.id}`)
        .set('X-API-Key', apiKey)
        .expect(200);

      const cancelledPayment = cancelledPaymentResponse.body.data;
      expect(cancelledPayment.status).toBe(PaymentStatus.CANCELLED);
    });
  });

  describe('Payment Method Management', () => {
    it('should create and manage multiple payment methods', async () => {
      // Create USSD payment method
      const ussdPaymentMethodResponse = await request(app.getHttpServer())
        .post('/api/v1/payment-methods')
        .set('X-API-Key', apiKey)
        .send({
          type: PaymentMethodType.USSD,
          provider: 'GTBank',
          metadata: {
            code: '*737#',
            bankCode: '058',
          },
        })
        .expect(201);

      const ussdPaymentMethod = ussdPaymentMethodResponse.body.data;
      expect(ussdPaymentMethod.type).toBe(PaymentMethodType.USSD);

      // Create wallet payment method
      const walletPaymentMethodResponse = await request(app.getHttpServer())
        .post('/api/v1/payment-methods')
        .set('X-API-Key', apiKey)
        .send({
          type: PaymentMethodType.WALLET,
          provider: 'Paga',
          metadata: {
            walletId: 'PAGA_123456',
            phoneNumber: '+2348012345678',
          },
        })
        .expect(201);

      const walletPaymentMethod = walletPaymentMethodResponse.body.data;
      expect(walletPaymentMethod.type).toBe(PaymentMethodType.WALLET);

      // List all payment methods
      const paymentMethodsResponse = await request(app.getHttpServer())
        .get('/api/v1/payment-methods')
        .set('X-API-Key', apiKey)
        .expect(200);

      const paymentMethods = paymentMethodsResponse.body.data;
      expect(Array.isArray(paymentMethods)).toBe(true);
      expect(paymentMethods.length).toBeGreaterThanOrEqual(3); // card, bank_account, ussd, wallet

      // Deactivate a payment method
      const deactivateResponse = await request(app.getHttpServer())
        .delete(`/api/v1/payment-methods/${ussdPaymentMethod.id}`)
        .set('X-API-Key', apiKey)
        .expect(200);

      expect(deactivateResponse.body.data).toBe(null);
      expect(deactivateResponse.body.message).toBe('Payment method deactivated successfully');
    });
  });

  describe('Security and Validation', () => {
    it('should reject unauthorized requests', async () => {
      // Create merchant and payment method for this test
      const timestamp = Date.now();
      const merchantResponse = await request(app.getHttpServer())
        .post('/api/v1/merchants')
        .send({
          name: 'Unauthorized Test Merchant',
          email: `unauthorized-${timestamp}@test.com`,
          webhookUrl: 'https://api.unauthorizedtest.com/webhooks',
        })
        .expect(201);

      const testMerchant = merchantResponse.body.data;
      const testApiKey = testMerchant.apiKey;

      const paymentMethodResponse = await request(app.getHttpServer())
        .post('/api/v1/payment-methods')
        .set('X-API-Key', testApiKey)
        .send({
          type: PaymentMethodType.CARD,
          lastFour: '1111',
          metadata: {
            cardNumber: '4111111111111111',
            expiryMonth: '12',
            expiryYear: '2025',
            cvv: '123',
            cardholderName: 'Unauthorized Test User',
          },
        })
        .expect(201);

      const testPaymentMethod = paymentMethodResponse.body.data;

      // Try to access protected endpoint without API key
      await request(app.getHttpServer())
        .post('/api/v1/payments')
        .send({
          amount: 1000,
          currency: 'NGN',
          paymentMethodId: testPaymentMethod.id,
        })
        .expect(401);

      // Try to access protected endpoint with invalid API key
      await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', 'invalid-api-key')
        .send({
          amount: 1000,
          currency: 'NGN',
          paymentMethodId: paymentMethod.id,
        })
        .expect(401);
    });

    it('should validate payment method ownership', async () => {
      // Create first merchant and payment method
      const timestamp1 = Date.now();
      const merchant1Response = await request(app.getHttpServer())
        .post('/api/v1/merchants')
        .send({
          name: 'First Merchant Ltd',
          email: `first-${timestamp1}@test.com`,
          webhookUrl: 'https://api.firsttest.com/webhooks',
        })
        .expect(201);

      const merchant1 = merchant1Response.body.data;

      const paymentMethod1Response = await request(app.getHttpServer())
        .post('/api/v1/payment-methods')
        .set('X-API-Key', merchant1.apiKey)
        .send({
          type: PaymentMethodType.CARD,
          lastFour: '1111',
          metadata: {
            cardNumber: '4111111111111111',
            expiryMonth: '12',
            expiryYear: '2025',
            cvv: '123',
            cardholderName: 'First Test User',
          },
        })
        .expect(201);

      const paymentMethod1 = paymentMethod1Response.body.data;

      // Create second merchant
      const timestamp2 = Date.now() + 1;
      const merchant2Response = await request(app.getHttpServer())
        .post('/api/v1/merchants')
        .send({
          name: 'Second Merchant Ltd',
          email: `second-${timestamp2}@test.com`,
          webhookUrl: 'https://api.secondtest.com/webhooks',
        })
        .expect(201);

      const merchant2 = merchant2Response.body.data;

      // Try to use first merchant's payment method with second merchant's API key
      await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', merchant2.apiKey)
        .send({
          amount: 1000,
          currency: 'NGN',
          paymentMethodId: paymentMethod1.id, // First merchant's payment method
        })
        .expect(404); // Payment method not found for this merchant
    });

    it('should validate input data', async () => {
      // Create merchant and payment method for this test
      const timestamp = Date.now();
      const merchantResponse = await request(app.getHttpServer())
        .post('/api/v1/merchants')
        .send({
          name: 'Validation Test Merchant',
          email: `validation-${timestamp}@test.com`,
          webhookUrl: 'https://api.validationtest.com/webhooks',
        })
        .expect(201);

      const testMerchant = merchantResponse.body.data;
      const testApiKey = testMerchant.apiKey;

      const paymentMethodResponse = await request(app.getHttpServer())
        .post('/api/v1/payment-methods')
        .set('X-API-Key', testApiKey)
        .send({
          type: PaymentMethodType.CARD,
          lastFour: '1111',
          metadata: {
            cardNumber: '4111111111111111',
            expiryMonth: '12',
            expiryYear: '2025',
            cvv: '123',
            cardholderName: 'Validation Test User',
          },
        })
        .expect(201);

      const testPaymentMethod = paymentMethodResponse.body.data;

      // Try to create payment with invalid amount
      await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', testApiKey)
        .send({
          amount: -100, // Invalid negative amount
          currency: 'NGN',
          paymentMethodId: testPaymentMethod.id,
        })
        .expect(400);

      // Try to create payment with invalid currency
      await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', testApiKey)
        .send({
          amount: 1000,
          currency: 'USD', // Invalid currency (should be NGN)
          paymentMethodId: testPaymentMethod.id,
        })
        .expect(400);

      // Try to create payment with non-existent payment method
      await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', testApiKey)
        .send({
          amount: 1000,
          currency: 'NGN',
          paymentMethodId: 'non-existent-id',
        })
        .expect(400); // UUID validation catches this before it reaches the service
    });
  });

  describe('Error Handling', () => {
    it('should handle webhook for non-existent payment', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment-gateway')
        .send({
          reference: 'PAY-NON-EXISTENT-123',
          status: PaymentStatus.COMPLETED,
        })
        .expect(404);
    });

    it('should handle webhook for already completed payment', async () => {
      // Create merchant and payment method for this test
      const timestamp = Date.now();
      const merchantResponse = await request(app.getHttpServer())
        .post('/api/v1/merchants')
        .send({
          name: 'Completed Test Merchant',
          email: `completed-${timestamp}@test.com`,
          webhookUrl: 'https://api.completedtest.com/webhooks',
        })
        .expect(201);

      const testMerchant = merchantResponse.body.data;
      const testApiKey = testMerchant.apiKey;

      const paymentMethodResponse = await request(app.getHttpServer())
        .post('/api/v1/payment-methods')
        .set('X-API-Key', testApiKey)
        .send({
          type: PaymentMethodType.CARD,
          lastFour: '1111',
          metadata: {
            cardNumber: '4111111111111111',
            expiryMonth: '12',
            expiryYear: '2025',
            cvv: '123',
            cardholderName: 'Completed Test User',
          },
        })
        .expect(201);

      const testPaymentMethod = paymentMethodResponse.body.data;

      // First, create and complete a payment
      const paymentResponse = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('X-API-Key', testApiKey)
        .send({
          amount: 1000,
          currency: 'NGN',
          paymentMethodId: testPaymentMethod.id,
        })
        .expect(201);

      const payment = paymentResponse.body.data;

      // Complete the payment
      await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment-gateway')
        .send({
          reference: payment.reference,
          status: PaymentStatus.COMPLETED,
        })
        .expect(200);

      // Try to process the same webhook again (should be idempotent)
      await request(app.getHttpServer())
        .post('/api/v1/webhooks/payment-gateway')
        .send({
          reference: payment.reference,
          status: PaymentStatus.COMPLETED,
        })
        .expect(200); // Should succeed but not change status
    });
  });
});
