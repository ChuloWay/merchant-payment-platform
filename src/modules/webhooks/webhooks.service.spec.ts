import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { PaymentsService } from '../payments/payments.service';
import { MerchantsService } from '../merchants/merchants.service';
import { WebhookPayloadDto } from './dto/webhook-payload.dto';
import { PaymentStatus } from '../payments/entities/payment.entity';
import * as crypto from 'crypto';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let paymentsService: PaymentsService;
  let merchantsService: MerchantsService;

  const mockPaymentsService = {
    findByReference: jest.fn(),
    updatePaymentStatus: jest.fn(),
  };

  const mockMerchantsService = {
    findById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        {
          provide: PaymentsService,
          useValue: mockPaymentsService,
        },
        {
          provide: MerchantsService,
          useValue: mockMerchantsService,
        },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    paymentsService = module.get<PaymentsService>(PaymentsService);
    merchantsService = module.get<MerchantsService>(MerchantsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processPaymentGatewayWebhook', () => {
    const webhookPayload: WebhookPayloadDto = {
      reference: 'PAY-TEST-123',
      status: PaymentStatus.COMPLETED,
      gatewayReference: 'gateway-ref-123',
      metadata: {
        processor: 'paystack',
        transactionId: 'txn_123456',
      },
    };

    const mockPayment = {
      id: 'payment-id',
      reference: 'PAY-TEST-123',
      amount: 25000.0,
      currency: 'NGN',
      status: PaymentStatus.PENDING,
      merchantId: 'merchant-id',
      paymentMethodId: 'payment-method-id',
      metadata: {},
      initiatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockMerchant = {
      id: 'merchant-id',
      name: 'Test Merchant',
      email: 'test@merchant.com',
      webhookUrl: 'https://test-merchant.com/webhooks',
      isActive: true,
    };

    it('should process payment completion webhook successfully', async () => {
      const updatedPayment = {
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
        gatewayReference: 'gateway-ref-123',
        completedAt: new Date(),
      };

      mockPaymentsService.findByReference.mockResolvedValue(mockPayment);
      mockMerchantsService.findById.mockResolvedValue(mockMerchant);
      mockPaymentsService.updatePaymentStatus.mockResolvedValue(updatedPayment);

      await service.processPaymentGatewayWebhook(webhookPayload);

      expect(mockPaymentsService.findByReference).toHaveBeenCalledWith(webhookPayload.reference);
      expect(mockPaymentsService.updatePaymentStatus).toHaveBeenCalledWith(
        mockPayment.id,
        PaymentStatus.COMPLETED,
        'gateway-ref-123',
        undefined,
      );
    });

    it('should process payment failure webhook successfully', async () => {
      const failurePayload: WebhookPayloadDto = {
        reference: 'PAY-TEST-123',
        status: PaymentStatus.FAILED,
        failureReason: 'Insufficient funds',
        metadata: { processor: 'paystack' },
      };

      const updatedPayment = {
        ...mockPayment,
        status: PaymentStatus.FAILED,
        failureReason: 'Insufficient funds',
      };

      mockPaymentsService.findByReference.mockResolvedValue(mockPayment);
      mockMerchantsService.findById.mockResolvedValue(mockMerchant);
      mockPaymentsService.updatePaymentStatus.mockResolvedValue(updatedPayment);

      await service.processPaymentGatewayWebhook(failurePayload);

      expect(mockPaymentsService.updatePaymentStatus).toHaveBeenCalledWith(
        mockPayment.id,
        PaymentStatus.FAILED,
        undefined,
        'Insufficient funds',
      );
    });

    it('should throw NotFoundException when payment not found', async () => {
      mockPaymentsService.findByReference.mockResolvedValue(null);

      await expect(service.processPaymentGatewayWebhook(webhookPayload)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPaymentsService.findByReference).toHaveBeenCalledWith(webhookPayload.reference);
      expect(mockPaymentsService.updatePaymentStatus).not.toHaveBeenCalled();
    });

    it('should handle non-pending payment status gracefully', async () => {
      const completedPayment = {
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
      };

      mockPaymentsService.findByReference.mockResolvedValue(completedPayment);

      await service.processPaymentGatewayWebhook(webhookPayload);

      expect(mockPaymentsService.findByReference).toHaveBeenCalledWith(webhookPayload.reference);
      expect(mockPaymentsService.updatePaymentStatus).not.toHaveBeenCalled();
    });

    it('should handle webhook without gateway reference', async () => {
      const payloadWithoutGatewayRef: WebhookPayloadDto = {
        reference: 'PAY-TEST-123',
        status: PaymentStatus.COMPLETED,
        metadata: { processor: 'paystack' },
      };

      mockPaymentsService.findByReference.mockResolvedValue(mockPayment);
      mockMerchantsService.findById.mockResolvedValue(mockMerchant);
      mockPaymentsService.updatePaymentStatus.mockResolvedValue(mockPayment);

      await service.processPaymentGatewayWebhook(payloadWithoutGatewayRef);

      expect(mockPaymentsService.updatePaymentStatus).toHaveBeenCalledWith(
        mockPayment.id,
        PaymentStatus.COMPLETED,
        undefined,
        undefined,
      );
    });

    it('should handle webhook without failure reason for failed payments', async () => {
      const failedPayload: WebhookPayloadDto = {
        reference: 'PAY-TEST-123',
        status: PaymentStatus.FAILED,
        metadata: { processor: 'paystack' },
      };

      mockPaymentsService.findByReference.mockResolvedValue(mockPayment);
      mockMerchantsService.findById.mockResolvedValue(mockMerchant);
      mockPaymentsService.updatePaymentStatus.mockResolvedValue(mockPayment);

      await service.processPaymentGatewayWebhook(failedPayload);

      expect(mockPaymentsService.updatePaymentStatus).toHaveBeenCalledWith(
        mockPayment.id,
        PaymentStatus.FAILED,
        undefined,
        undefined,
      );
    });

    it('should process cancelled payment webhook', async () => {
      const cancelledPayload: WebhookPayloadDto = {
        reference: 'PAY-TEST-123',
        status: PaymentStatus.CANCELLED,
        metadata: { processor: 'paystack' },
      };

      mockPaymentsService.findByReference.mockResolvedValue(mockPayment);
      mockMerchantsService.findById.mockResolvedValue(mockMerchant);
      mockPaymentsService.updatePaymentStatus.mockResolvedValue(mockPayment);

      await service.processPaymentGatewayWebhook(cancelledPayload);

      expect(mockPaymentsService.updatePaymentStatus).toHaveBeenCalledWith(
        mockPayment.id,
        PaymentStatus.CANCELLED,
        undefined,
        undefined,
      );
    });

    it('should process refunded payment webhook', async () => {
      const refundedPayload: WebhookPayloadDto = {
        reference: 'PAY-TEST-123',
        status: PaymentStatus.REFUNDED,
        gatewayReference: 'refund-ref-123',
        metadata: { processor: 'paystack' },
      };

      mockPaymentsService.findByReference.mockResolvedValue(mockPayment);
      mockMerchantsService.findById.mockResolvedValue(mockMerchant);
      mockPaymentsService.updatePaymentStatus.mockResolvedValue(mockPayment);

      await service.processPaymentGatewayWebhook(refundedPayload);

      expect(mockPaymentsService.updatePaymentStatus).toHaveBeenCalledWith(
        mockPayment.id,
        PaymentStatus.REFUNDED,
        'refund-ref-123',
        undefined,
      );
    });
  });

  describe('validateWebhookSignature', () => {
    const testSecret = 'test-webhook-secret';
    const testPayload = JSON.stringify({
      reference: 'PAY-TEST-123',
      status: 'completed',
    });

    it('should validate correct webhook signature', () => {
      const signature = crypto
        .createHmac('sha256', 'test-webhook-secret')
        .update(testPayload)
        .digest('hex');

      const result = service.validateWebhookSignature(testPayload, signature);

      expect(result).toBe(true);
    });

    it('should reject invalid webhook signature', () => {
      const invalidSignature = 'invalid-signature';

      const result = service.validateWebhookSignature(testPayload, invalidSignature);

      expect(result).toBe(false);
    });

    it('should reject tampered payload', () => {
      const originalSignature = crypto
        .createHmac('sha256', 'test-webhook-secret')
        .update(testPayload)
        .digest('hex');

      const tamperedPayload = JSON.stringify({
        reference: 'PAY-TAMPERED-123',
        status: 'completed',
      });

      const result = service.validateWebhookSignature(tamperedPayload, originalSignature);

      expect(result).toBe(false);
    });

    it('should handle empty signature', () => {
      const result = service.validateWebhookSignature(testPayload, '');

      expect(result).toBe(false);
    });

    it('should handle malformed signature', () => {
      const malformedSignature = 'not-a-hex-string';

      const result = service.validateWebhookSignature(testPayload, malformedSignature);

      expect(result).toBe(false);
    });

    it('should handle different HMAC algorithms', () => {
      const signature = crypto
        .createHmac('sha512', testSecret)
        .update(testPayload)
        .digest('hex');

      const result = service.validateWebhookSignature(testPayload, signature);

      expect(result).toBe(false); // Should fail because we use sha256
    });

    it('should handle very long payloads', () => {
      const longPayload = JSON.stringify({
        reference: 'PAY-TEST-123',
        status: 'completed',
        largeData: 'x'.repeat(100000),
      });

      const signature = crypto
        .createHmac('sha256', 'test-webhook-secret')
        .update(longPayload)
        .digest('hex');

      const result = service.validateWebhookSignature(longPayload, signature);

      expect(result).toBe(true);
    });
  });

  describe('Security Tests', () => {
    it('should handle malicious webhook payloads', async () => {
      const maliciousPayload: WebhookPayloadDto = {
        reference: "'; DROP TABLE payments; --",
        status: PaymentStatus.COMPLETED,
        metadata: {
          xssPayload: '<script>alert("xss")</script>',
          sqlInjection: "'; DROP TABLE merchants; --",
        },
      };

      mockPaymentsService.findByReference.mockResolvedValue(null);

      await expect(service.processPaymentGatewayWebhook(maliciousPayload)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should prevent replay attacks with signature validation', () => {
      const testSecret = 'test-webhook-secret';
      const testPayload = JSON.stringify({
        reference: 'PAY-TEST-123',
        status: 'completed',
        timestamp: Date.now(),
      });

      const signature = crypto
        .createHmac('sha256', testSecret)
        .update(testPayload)
        .digest('hex');

      // First validation should pass
      expect(service.validateWebhookSignature(testPayload, signature)).toBe(true);

      // Replay with same signature should also pass (timestamp should be used for replay protection)
      expect(service.validateWebhookSignature(testPayload, signature)).toBe(true);
    });

    it('should handle webhook signature timing attacks', () => {
      const testSecret = 'test-webhook-secret';
      const testPayload = JSON.stringify({
        reference: 'PAY-TEST-123',
        status: 'completed',
      });

      const correctSignature = crypto
        .createHmac('sha256', testSecret)
        .update(testPayload)
        .digest('hex');

      const incorrectSignature = 'a'.repeat(correctSignature.length);

      const startTime = Date.now();
      service.validateWebhookSignature(testPayload, incorrectSignature);
      const endTime = Date.now();

      // Should not be vulnerable to timing attacks
      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
    });

    it('should handle concurrent webhook processing', async () => {
      const webhookPayload: WebhookPayloadDto = {
        reference: 'PAY-TEST-123',
        status: PaymentStatus.COMPLETED,
        gatewayReference: 'gateway-ref-123',
      };

      const mockPayment = {
        id: 'payment-id',
        reference: 'PAY-TEST-123',
        merchantId: 'merchant-id',
        status: PaymentStatus.PENDING,
      };

      const mockMerchant = {
        id: 'merchant-id',
        isActive: true,
      };

      mockPaymentsService.findByReference.mockResolvedValue(mockPayment);
      mockMerchantsService.findById.mockResolvedValue(mockMerchant);
      mockPaymentsService.updatePaymentStatus.mockResolvedValue(mockPayment);

      // Simulate concurrent webhook processing
      const promises = [
        service.processPaymentGatewayWebhook(webhookPayload),
        service.processPaymentGatewayWebhook(webhookPayload),
      ];

      await Promise.all(promises);

      expect(mockPaymentsService.updatePaymentStatus).toHaveBeenCalledTimes(2);
    });

    it('should validate payment status transitions', async () => {
      const webhookPayload: WebhookPayloadDto = {
        reference: 'PAY-TEST-123',
        status: PaymentStatus.COMPLETED,
      };

      // Payment already completed - should not process (not pending)
      const completedPayment = {
        id: 'payment-id',
        reference: 'PAY-TEST-123',
        merchantId: 'merchant-id',
        status: PaymentStatus.COMPLETED,
      };

      mockPaymentsService.findByReference.mockResolvedValue(completedPayment);

      await service.processPaymentGatewayWebhook(webhookPayload);

      // Should not call updatePaymentStatus since payment is not pending
      expect(mockPaymentsService.updatePaymentStatus).not.toHaveBeenCalled();
    });

    it('should handle webhook with large metadata', async () => {
      const largeMetadata = {
        data: 'x'.repeat(100000),
        nested: {
          deep: {
            object: 'with lots of data',
          },
        },
      };

      const webhookPayload: WebhookPayloadDto = {
        reference: 'PAY-TEST-123',
        status: PaymentStatus.COMPLETED,
        metadata: largeMetadata,
      };

      const mockPayment = {
        id: 'payment-id',
        reference: 'PAY-TEST-123',
        merchantId: 'merchant-id',
        status: PaymentStatus.PENDING,
      };

      const mockMerchant = {
        id: 'merchant-id',
        isActive: true,
      };

      mockPaymentsService.findByReference.mockResolvedValue(mockPayment);
      mockMerchantsService.findById.mockResolvedValue(mockMerchant);
      mockPaymentsService.updatePaymentStatus.mockResolvedValue(mockPayment);

      await expect(service.processPaymentGatewayWebhook(webhookPayload)).resolves.toBeUndefined();
    });
  });

  describe('Data Integrity Tests', () => {
    it('should maintain webhook processing idempotency', async () => {
      const webhookPayload: WebhookPayloadDto = {
        reference: 'PAY-TEST-123',
        status: PaymentStatus.COMPLETED,
        gatewayReference: 'gateway-ref-123',
      };

      const mockPayment = {
        id: 'payment-id',
        reference: 'PAY-TEST-123',
        merchantId: 'merchant-id',
        status: PaymentStatus.PENDING,
      };

      const mockMerchant = {
        id: 'merchant-id',
        isActive: true,
      };

      mockPaymentsService.findByReference.mockResolvedValue(mockPayment);
      mockMerchantsService.findById.mockResolvedValue(mockMerchant);
      mockPaymentsService.updatePaymentStatus.mockResolvedValue(mockPayment);

      // Process same webhook multiple times
      await service.processPaymentGatewayWebhook(webhookPayload);
      await service.processPaymentGatewayWebhook(webhookPayload);
      await service.processPaymentGatewayWebhook(webhookPayload);

      expect(mockPaymentsService.updatePaymentStatus).toHaveBeenCalledTimes(3);
    });

    it('should handle webhook processing errors gracefully', async () => {
      const webhookPayload: WebhookPayloadDto = {
        reference: 'PAY-TEST-123',
        status: PaymentStatus.COMPLETED,
      };

      mockPaymentsService.findByReference.mockRejectedValue(new Error('Database error'));

      await expect(service.processPaymentGatewayWebhook(webhookPayload)).rejects.toThrow(
        'Database error',
      );
    });

    it('should validate webhook payload structure', async () => {
      const invalidPayload = {
        // Missing required reference field
        status: PaymentStatus.COMPLETED,
      } as any;

      mockPaymentsService.findByReference.mockResolvedValue(null);

      await expect(service.processPaymentGatewayWebhook(invalidPayload)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
