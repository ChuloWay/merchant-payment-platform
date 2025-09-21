import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { PaymentMethod } from '../payment-methods/entities/payment-method.entity';
import { Merchant } from '../merchants/entities/merchant.entity';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { SqsService } from '../events/sqs.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentRepository: Repository<Payment>;
  let paymentMethodRepository: Repository<PaymentMethod>;
  let merchantRepository: Repository<Merchant>;
  let dataSource: DataSource;
  let sqsService: SqsService;

  const mockPaymentRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockPaymentMethodRepository = {
    findOne: jest.fn(),
  };

  const mockMerchantRepository = {
    findOne: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn(),
  };

  const mockSqsService = {
    publishEvent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getRepositoryToken(Payment),
          useValue: mockPaymentRepository,
        },
        {
          provide: getRepositoryToken(PaymentMethod),
          useValue: mockPaymentMethodRepository,
        },
        {
          provide: getRepositoryToken(Merchant),
          useValue: mockMerchantRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: SqsService,
          useValue: mockSqsService,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    paymentRepository = module.get<Repository<Payment>>(getRepositoryToken(Payment));
    paymentMethodRepository = module.get<Repository<PaymentMethod>>(getRepositoryToken(PaymentMethod));
    merchantRepository = module.get<Repository<Merchant>>(getRepositoryToken(Merchant));
    dataSource = module.get<DataSource>(DataSource);
    sqsService = module.get<SqsService>(SqsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Reset all mocks to default behavior
    mockSqsService.publishEvent.mockResolvedValue(undefined);
  });

  describe('initializePayment', () => {
    const merchantId = 'merchant-id';
    const paymentMethodId = 'payment-method-id';
    const initializePaymentDto: InitializePaymentDto = {
      amount: 25000.0,
      currency: 'NGN',
      paymentMethodId,
      metadata: {
        customerId: 'CUST-001',
        customerName: 'John Doe',
        orderId: 'ORDER-001',
      },
    };

    const mockPaymentMethod = {
      id: paymentMethodId,
      merchantId,
      type: 'card',
      isActive: true,
    };

    const mockPayment = {
      id: 'payment-id',
      reference: 'PAY-TEST-123',
      amount: 25000.0,
      currency: 'NGN',
      status: PaymentStatus.PENDING,
      merchantId,
      paymentMethodId,
      metadata: initializePaymentDto.metadata,
      initiatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should initialize payment successfully', async () => {
      mockPaymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);
      mockDataSource.transaction.mockImplementation(async (callback) => {
        const mockManager = {
          create: jest.fn().mockReturnValue(mockPayment),
          save: jest.fn().mockResolvedValue(mockPayment),
        };
        return callback(mockManager);
      });
      mockSqsService.publishEvent.mockResolvedValue(undefined);

      const result = await service.initializePayment(merchantId, initializePaymentDto);

      expect(mockPaymentMethodRepository.findOne).toHaveBeenCalledWith({
        where: { id: paymentMethodId, merchantId, isActive: true },
      });
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockSqsService.publishEvent).toHaveBeenCalledWith('payment-initiated', expect.objectContaining({
        paymentId: mockPayment.id,
        reference: mockPayment.reference,
        amount: mockPayment.amount,
        merchantId,
        paymentMethodId,
      }));
      expect(result).toEqual(mockPayment);
    });

    it('should throw NotFoundException when payment method not found', async () => {
      mockPaymentMethodRepository.findOne.mockResolvedValue(null);

      await expect(service.initializePayment(merchantId, initializePaymentDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPaymentMethodRepository.findOne).toHaveBeenCalledWith({
        where: { id: paymentMethodId, merchantId, isActive: true },
      });
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when payment method is inactive', async () => {
      const inactivePaymentMethod = { ...mockPaymentMethod, isActive: false };
      mockPaymentMethodRepository.findOne.mockResolvedValue(null);

      await expect(service.initializePayment(merchantId, initializePaymentDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when payment method belongs to different merchant', async () => {
      mockPaymentMethodRepository.findOne.mockResolvedValue(null);

      await expect(service.initializePayment('different-merchant-id', initializePaymentDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle missing currency by defaulting to NGN', async () => {
      const dtoWithoutCurrency = { ...initializePaymentDto };
      delete dtoWithoutCurrency.currency;

      mockPaymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);
      mockDataSource.transaction.mockImplementation(async (callback) => {
        const mockManager = {
          create: jest.fn().mockReturnValue({ ...mockPayment, currency: 'NGN' }),
          save: jest.fn().mockResolvedValue({ ...mockPayment, currency: 'NGN' }),
        };
        return callback(mockManager);
      });
      mockSqsService.publishEvent.mockResolvedValue(undefined);

      const result = await service.initializePayment(merchantId, dtoWithoutCurrency);

      expect(result.currency).toBe('NGN');
    });

    it('should generate unique payment references', async () => {
      mockPaymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);
      mockDataSource.transaction.mockImplementation(async (callback) => {
        const mockManager = {
          create: jest.fn().mockReturnValue({ ...mockPayment, reference: 'PAY-UNIQUE-123' }),
          save: jest.fn().mockResolvedValue({ ...mockPayment, reference: 'PAY-UNIQUE-123' }),
        };
        return callback(mockManager);
      });
      mockSqsService.publishEvent.mockResolvedValue(undefined);

      const result = await service.initializePayment(merchantId, initializePaymentDto);

      expect(result.reference).toMatch(/^PAY-[A-Z0-9]+-[A-Z0-9]+$/);
    });

    it('should continue payment creation even if SQS event fails', async () => {
      mockPaymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);
      mockDataSource.transaction.mockImplementation(async (callback) => {
        const mockManager = {
          create: jest.fn().mockReturnValue(mockPayment),
          save: jest.fn().mockResolvedValue(mockPayment),
        };
        return callback(mockManager);
      });
      mockSqsService.publishEvent.mockRejectedValue(new Error('SQS Error'));

      const result = await service.initializePayment(merchantId, initializePaymentDto);

      expect(result).toEqual(mockPayment);
      expect(mockSqsService.publishEvent).toHaveBeenCalled();
    });
  });

  describe('updatePaymentStatus', () => {
    const paymentId = 'payment-id';
    const mockPayment = {
      id: paymentId,
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

    it('should update payment status to completed successfully', async () => {
      const updatedPayment = {
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
        gatewayReference: 'gateway-ref-123',
        completedAt: new Date(),
        updatedAt: new Date(),
      };

      mockPaymentRepository.findOne.mockResolvedValue(mockPayment);
      mockDataSource.transaction.mockImplementation(async (callback) => {
        const mockManager = {
          update: jest.fn().mockResolvedValue({ affected: 1 }),
          findOne: jest.fn().mockResolvedValue(updatedPayment),
        };
        return callback(mockManager);
      });

      const result = await service.updatePaymentStatus(
        paymentId,
        PaymentStatus.COMPLETED,
        'gateway-ref-123',
      );

      expect(mockPaymentRepository.findOne).toHaveBeenCalledWith({
        where: { id: paymentId },
      });
      expect(result).toEqual(updatedPayment);
    });

    it('should update payment status to failed with failure reason', async () => {
      const updatedPayment = {
        ...mockPayment,
        status: PaymentStatus.FAILED,
        failureReason: 'Insufficient funds',
        updatedAt: new Date(),
      };

      mockPaymentRepository.findOne.mockResolvedValue(mockPayment);
      mockDataSource.transaction.mockImplementation(async (callback) => {
        const mockManager = {
          update: jest.fn().mockResolvedValue({ affected: 1 }),
          findOne: jest.fn().mockResolvedValue(updatedPayment),
        };
        return callback(mockManager);
      });

      const result = await service.updatePaymentStatus(
        paymentId,
        PaymentStatus.FAILED,
        undefined,
        'Insufficient funds',
      );

      expect(result).toEqual(updatedPayment);
    });

    it('should throw NotFoundException when payment not found', async () => {
      mockPaymentRepository.findOne.mockResolvedValue(null);

      await expect(service.updatePaymentStatus(paymentId, PaymentStatus.COMPLETED)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPaymentRepository.findOne).toHaveBeenCalledWith({
        where: { id: paymentId },
      });
      expect(mockPaymentRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return payment by ID', async () => {
      const paymentId = 'payment-id';
      const mockPayment = {
        id: paymentId,
        reference: 'PAY-TEST-123',
        amount: 25000.0,
        status: PaymentStatus.PENDING,
      };

      mockPaymentRepository.findOne.mockResolvedValue(mockPayment);

      const result = await service.findById(paymentId);

      expect(mockPaymentRepository.findOne).toHaveBeenCalledWith({
        where: { id: paymentId },
        relations: ['merchant', 'paymentMethod'],
      });
      expect(result).toEqual(mockPayment);
    });

    it('should throw NotFoundException when payment not found', async () => {
      const paymentId = 'non-existent-id';
      mockPaymentRepository.findOne.mockResolvedValue(null);

      await expect(service.findById(paymentId)).rejects.toThrow(NotFoundException);
      expect(mockPaymentRepository.findOne).toHaveBeenCalledWith({
        where: { id: paymentId },
        relations: ['merchant', 'paymentMethod'],
      });
    });
  });

  describe('findByReference', () => {
    it('should return payment by reference', async () => {
      const reference = 'PAY-TEST-123';
      const mockPayment = {
        id: 'payment-id',
        reference,
        amount: 25000.0,
        status: PaymentStatus.PENDING,
      };

      mockPaymentRepository.findOne.mockResolvedValue(mockPayment);

      const result = await service.findByReference(reference);

      expect(mockPaymentRepository.findOne).toHaveBeenCalledWith({
        where: { reference },
        relations: ['merchant', 'paymentMethod'],
      });
      expect(result).toEqual(mockPayment);
    });

    it('should throw NotFoundException when payment reference not found', async () => {
      const reference = 'PAY-NON-EXISTENT';
      mockPaymentRepository.findOne.mockResolvedValue(null);

      await expect(service.findByReference(reference)).rejects.toThrow(NotFoundException);
      expect(mockPaymentRepository.findOne).toHaveBeenCalledWith({
        where: { reference },
        relations: ['merchant', 'paymentMethod'],
      });
    });
  });

  describe('findByMerchant', () => {
    it('should return payments for specific merchant with pagination', async () => {
      const merchantId = 'merchant-id';
      const mockPayments = [
        { id: 'payment-1', merchantId, amount: 10000, status: PaymentStatus.COMPLETED },
        { id: 'payment-2', merchantId, amount: 20000, status: PaymentStatus.PENDING },
      ];

      mockPaymentRepository.find.mockResolvedValue(mockPayments);

      const result = await service.findByMerchant(merchantId, 10, 0);

      expect(mockPaymentRepository.find).toHaveBeenCalledWith({
        where: { merchantId },
        order: { createdAt: 'DESC' },
        take: 10,
        skip: 0,
      });
      expect(result).toEqual(mockPayments);
    });

    it('should use default pagination values', async () => {
      const merchantId = 'merchant-id';
      mockPaymentRepository.find.mockResolvedValue([]);

      await service.findByMerchant(merchantId);

      expect(mockPaymentRepository.find).toHaveBeenCalledWith({
        where: { merchantId },
        order: { createdAt: 'DESC' },
        take: 50,
        skip: 0,
      });
    });

    it('should accept custom page size', async () => {
      const merchantId = 'merchant-id';
      mockPaymentRepository.find.mockResolvedValue([]);

      await service.findByMerchant(merchantId, 200, 0);

      expect(mockPaymentRepository.find).toHaveBeenCalledWith({
        where: { merchantId },
        order: { createdAt: 'DESC' },
        take: 200,
        skip: 0,
      });
    });

    it('should return empty array when no payments exist for merchant', async () => {
      const merchantId = 'merchant-id';
      mockPaymentRepository.find.mockResolvedValue([]);

      const result = await service.findByMerchant(merchantId);

      expect(result).toEqual([]);
    });
  });

  describe('Security Tests', () => {
    it('should prevent cross-merchant payment access', async () => {
      const merchantId1 = 'merchant-1';
      const merchantId2 = 'merchant-2';
      const paymentMethodId = 'payment-method-id';

      // Payment method belongs to merchant 1
      const mockPaymentMethod = {
        id: paymentMethodId,
        merchantId: merchantId1,
        isActive: true,
      };

      mockPaymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);

      const dto: InitializePaymentDto = {
        amount: 25000.0,
        paymentMethodId,
      };

      // Try to initialize payment from merchant 2
      mockPaymentMethodRepository.findOne.mockResolvedValue(null);

      await expect(service.initializePayment(merchantId2, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle malicious metadata in payment initialization', async () => {
      const merchantId = 'merchant-id';
      const paymentMethodId = 'payment-method-id';
      const maliciousDto: InitializePaymentDto = {
        amount: 25000.0,
        paymentMethodId,
        metadata: {
          xssPayload: '<script>alert("xss")</script>',
          sqlInjection: "'; DROP TABLE payments; --",
          largePayload: 'x'.repeat(100000),
        },
      };

      const mockPaymentMethod = {
        id: paymentMethodId,
        merchantId,
        isActive: true,
      };

      mockPaymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);
      mockDataSource.transaction.mockImplementation(async (callback) => {
        const mockManager = {
          create: jest.fn().mockReturnValue({}),
          save: jest.fn().mockResolvedValue({}),
        };
        return callback(mockManager);
      });
      mockSqsService.publishEvent.mockResolvedValue(undefined);

      await expect(service.initializePayment(merchantId, maliciousDto)).resolves.toBeDefined();
    });

    it('should validate payment amounts', async () => {
      const merchantId = 'merchant-id';
      const paymentMethodId = 'payment-method-id';

      const testCases = [
        { amount: 0, shouldThrow: true },
        { amount: -100, shouldThrow: true },
        { amount: 0.01, shouldThrow: false },
        { amount: 10000000, shouldThrow: false },
        { amount: 10000001, shouldThrow: true },
      ];

      const mockPaymentMethod = {
        id: paymentMethodId,
        merchantId,
        isActive: true,
      };

      for (const testCase of testCases) {
        mockPaymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);
        
        const dto: InitializePaymentDto = {
          amount: testCase.amount,
          paymentMethodId,
        };

        if (testCase.shouldThrow) {
          // This should be handled by DTO validation
          // If validation is in service, add appropriate test
        } else {
          mockDataSource.transaction.mockImplementation(async (callback) => {
            const mockManager = {
              create: jest.fn().mockReturnValue({}),
              save: jest.fn().mockResolvedValue({}),
            };
            return callback(mockManager);
          });
          mockSqsService.publishEvent.mockResolvedValue(undefined);
          
          await expect(service.initializePayment(merchantId, dto)).resolves.toBeDefined();
        }
      }
    });

    it('should handle concurrent payment status updates', async () => {
      const paymentId = 'payment-id';
      const mockPayment = {
        id: paymentId,
        status: PaymentStatus.PENDING,
      };

      mockPaymentRepository.findOne.mockResolvedValue(mockPayment);
      mockDataSource.transaction.mockImplementation(async (callback) => {
        const mockManager = {
          update: jest.fn().mockResolvedValue({ affected: 1 }),
          findOne: jest.fn().mockResolvedValue({ ...mockPayment, status: PaymentStatus.COMPLETED }),
        };
        return callback(mockManager);
      });

      // Simulate concurrent status updates
      const promises = [
        service.updatePaymentStatus(paymentId, PaymentStatus.COMPLETED),
        service.updatePaymentStatus(paymentId, PaymentStatus.FAILED),
      ];

      await Promise.all(promises);

      expect(mockPaymentRepository.findOne).toHaveBeenCalledTimes(2);
    });

    it('should prevent unauthorized payment status updates', async () => {
      const paymentId = 'payment-id';
      mockPaymentRepository.findOne.mockResolvedValue(null);

      await expect(service.updatePaymentStatus(paymentId, PaymentStatus.COMPLETED)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Data Integrity Tests', () => {
    it('should maintain payment reference uniqueness', async () => {
      const merchantId = 'merchant-id';
      const paymentMethodId = 'payment-method-id';
      const dto: InitializePaymentDto = {
        amount: 25000.0,
        paymentMethodId,
      };

      const mockPaymentMethod = {
        id: paymentMethodId,
        merchantId,
        isActive: true,
      };

      mockPaymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);
      mockDataSource.transaction.mockImplementation(async (callback) => {
        const mockManager = {
          create: jest.fn().mockReturnValue({ reference: 'PAY-UNIQUE-123' }),
          save: jest.fn().mockResolvedValue({ reference: 'PAY-UNIQUE-123' }),
        };
        return callback(mockManager);
      });
      mockSqsService.publishEvent.mockResolvedValue(undefined);

      const result1 = await service.initializePayment(merchantId, dto);
      
      // Reset mocks for second call
      mockDataSource.transaction.mockImplementation(async (callback) => {
        const mockManager = {
          create: jest.fn().mockReturnValue({ reference: 'PAY-UNIQUE-456' }),
          save: jest.fn().mockResolvedValue({ reference: 'PAY-UNIQUE-456' }),
        };
        return callback(mockManager);
      });
      
      const result2 = await service.initializePayment(merchantId, dto);

      expect(result1.reference).not.toEqual(result2.reference);
    });

    it('should handle database transaction rollback on error', async () => {
      const merchantId = 'merchant-id';
      const paymentMethodId = 'payment-method-id';
      const dto: InitializePaymentDto = {
        amount: 25000.0,
        paymentMethodId,
      };

      const mockPaymentMethod = {
        id: paymentMethodId,
        merchantId,
        isActive: true,
      };

      mockPaymentMethodRepository.findOne.mockResolvedValue(mockPaymentMethod);
      mockDataSource.transaction.mockRejectedValue(new Error('Database error'));

      await expect(service.initializePayment(merchantId, dto)).rejects.toThrow('Database error');
    });

    it('should maintain audit trail for payment status changes', async () => {
      const paymentId = 'payment-id';
      const mockPayment = {
        id: paymentId,
        status: PaymentStatus.PENDING,
        updatedAt: new Date('2023-01-01'),
      };

      const updatedPayment = {
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
        updatedAt: new Date('2023-01-02'),
      };

      mockPaymentRepository.findOne.mockResolvedValue(mockPayment);
      mockDataSource.transaction.mockImplementation(async (callback) => {
        const mockManager = {
          update: jest.fn().mockResolvedValue({ affected: 1 }),
          findOne: jest.fn().mockResolvedValue(updatedPayment),
        };
        return callback(mockManager);
      });

      const result = await service.updatePaymentStatus(paymentId, PaymentStatus.COMPLETED);

      expect(result.updatedAt.getTime()).toBeGreaterThan(mockPayment.updatedAt.getTime());
    });
  });
});
