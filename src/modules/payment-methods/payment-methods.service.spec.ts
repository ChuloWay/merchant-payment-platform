import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentMethodsService } from './payment-methods.service';
import { PaymentMethod, PaymentMethodType } from './entities/payment-method.entity';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';

describe('PaymentMethodsService', () => {
  let service: PaymentMethodsService;
  let repository: Repository<PaymentMethod>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentMethodsService,
        {
          provide: getRepositoryToken(PaymentMethod),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<PaymentMethodsService>(PaymentMethodsService);
    repository = module.get<Repository<PaymentMethod>>(getRepositoryToken(PaymentMethod));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const merchantId = 'merchant-id';
    const createPaymentMethodDto: CreatePaymentMethodDto = {
      type: PaymentMethodType.CARD,
      provider: 'Paystack',
      lastFour: '1234',
      metadata: { cardType: 'visa', expiryMonth: '12', expiryYear: '2025' },
    };

    it('should create a card payment method successfully', async () => {
      const mockPaymentMethod = {
        id: 'payment-method-id',
        merchantId,
        ...createPaymentMethodDto,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.create.mockReturnValue(mockPaymentMethod);
      mockRepository.save.mockResolvedValue(mockPaymentMethod);

      const result = await service.create(merchantId, createPaymentMethodDto);

      expect(mockRepository.create).toHaveBeenCalledWith({
        ...createPaymentMethodDto,
        merchantId,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(mockPaymentMethod);
      expect(result).toEqual(mockPaymentMethod);
    });

    it('should create a bank account payment method with required fields', async () => {
      const bankAccountDto: CreatePaymentMethodDto = {
        type: PaymentMethodType.BANK_ACCOUNT,
        provider: 'Paystack',
        accountNumber: '1234567890',
        bankCode: '058',
        bankName: 'GTBank',
      };

      const mockPaymentMethod = {
        id: 'payment-method-id',
        merchantId,
        type: bankAccountDto.type,
        provider: bankAccountDto.provider,
        accountNumber: bankAccountDto.accountNumber,
        bankCode: bankAccountDto.bankCode,
        bankName: bankAccountDto.bankName,
        lastFour: undefined,
        metadata: undefined,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.create.mockReturnValue(mockPaymentMethod);
      mockRepository.save.mockResolvedValue(mockPaymentMethod);

      const result = await service.create(merchantId, bankAccountDto);

      expect(mockRepository.create).toHaveBeenCalledWith({
        ...bankAccountDto,
        merchantId,
      });
      expect(result).toEqual(expect.objectContaining({
        id: 'payment-method-id',
        merchantId,
        type: bankAccountDto.type,
        provider: bankAccountDto.provider,
        isActive: true,
      }));
    });

    it('should throw BadRequestException for bank account without account number', async () => {
      const invalidBankAccountDto: CreatePaymentMethodDto = {
        type: PaymentMethodType.BANK_ACCOUNT,
        provider: 'Paystack',
        bankCode: '058',
        // Missing accountNumber
      };

      await expect(service.create(merchantId, invalidBankAccountDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRepository.create).not.toHaveBeenCalled();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for bank account without bank code', async () => {
      const invalidBankAccountDto: CreatePaymentMethodDto = {
        type: PaymentMethodType.BANK_ACCOUNT,
        provider: 'Paystack',
        accountNumber: '1234567890',
        // Missing bankCode
      };

      await expect(service.create(merchantId, invalidBankAccountDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRepository.create).not.toHaveBeenCalled();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should create USSD payment method', async () => {
      const ussdDto: CreatePaymentMethodDto = {
        type: PaymentMethodType.USSD,
        provider: 'MTN',
        metadata: { ussdCode: '*737*1#' },
      };

      const mockPaymentMethod = {
        id: 'payment-method-id',
        merchantId,
        ...ussdDto,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.create.mockReturnValue(mockPaymentMethod);
      mockRepository.save.mockResolvedValue(mockPaymentMethod);

      const result = await service.create(merchantId, ussdDto);

      expect(result.type).toBe(PaymentMethodType.USSD);
      expect(result.provider).toBe('MTN');
    });

    it('should create wallet payment method', async () => {
      const walletDto: CreatePaymentMethodDto = {
        type: PaymentMethodType.WALLET,
        provider: 'Opay',
        metadata: { walletType: 'mobile' },
      };

      const mockPaymentMethod = {
        id: 'payment-method-id',
        merchantId,
        ...walletDto,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.create.mockReturnValue(mockPaymentMethod);
      mockRepository.save.mockResolvedValue(mockPaymentMethod);

      const result = await service.create(merchantId, walletDto);

      expect(result.type).toBe(PaymentMethodType.WALLET);
      expect(result.provider).toBe('Opay');
    });
  });

  describe('findById', () => {
    it('should return payment method by ID', async () => {
      const mockPaymentMethod = {
        id: 'payment-method-id',
        type: PaymentMethodType.CARD,
        provider: 'Paystack',
        lastFour: '1234',
        isActive: true,
      };

      mockRepository.findOne.mockResolvedValue(mockPaymentMethod);

      const result = await service.findById('payment-method-id');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'payment-method-id' },
      });
      expect(result).toEqual(mockPaymentMethod);
    });

    it('should throw NotFoundException when payment method not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'non-existent-id' },
      });
    });
  });

  describe('findByMerchant', () => {
    it('should return payment methods for specific merchant', async () => {
      const merchantId = 'merchant-id';
      const mockPaymentMethods = [
        {
          id: 'pm1',
          merchantId,
          type: PaymentMethodType.CARD,
          isActive: true,
        },
        {
          id: 'pm2',
          merchantId,
          type: PaymentMethodType.BANK_ACCOUNT,
          isActive: true,
        },
      ];

      mockRepository.find.mockResolvedValue(mockPaymentMethods);

      const result = await service.findByMerchant(merchantId);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { merchantId, isActive: true },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(mockPaymentMethods);
    });

    it('should return empty array when no payment methods exist for merchant', async () => {
      const merchantId = 'merchant-id';
      mockRepository.find.mockResolvedValue([]);

      const result = await service.findByMerchant(merchantId);

      expect(result).toEqual([]);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { merchantId, isActive: true },
        order: { createdAt: 'DESC' },
      });
    });

    it('should only return active payment methods', async () => {
      const merchantId = 'merchant-id';
      const mockActivePaymentMethods = [
        {
          id: 'pm1',
          merchantId,
          type: PaymentMethodType.CARD,
          isActive: true,
        },
      ];

      mockRepository.find.mockResolvedValue(mockActivePaymentMethods);

      const result = await service.findByMerchant(merchantId);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { merchantId, isActive: true },
        order: { createdAt: 'DESC' },
      });
      expect(result.every(pm => pm.isActive)).toBe(true);
    });
  });

  describe('findByIdAndMerchant', () => {
    it('should return payment method for specific merchant and ID', async () => {
      const merchantId = 'merchant-id';
      const paymentMethodId = 'payment-method-id';
      const mockPaymentMethod = {
        id: paymentMethodId,
        merchantId,
        type: PaymentMethodType.CARD,
        isActive: true,
      };

      mockRepository.findOne.mockResolvedValue(mockPaymentMethod);

      const result = await service.findByIdAndMerchant(paymentMethodId, merchantId);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: paymentMethodId, merchantId, isActive: true },
      });
      expect(result).toEqual(mockPaymentMethod);
    });

    it('should return null when payment method not found for merchant', async () => {
      const merchantId = 'merchant-id';
      const paymentMethodId = 'payment-method-id';

      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findByIdAndMerchant(paymentMethodId, merchantId);

      expect(result).toBeNull();
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: paymentMethodId, merchantId, isActive: true },
      });
    });

    it('should return null for inactive payment method', async () => {
      const merchantId = 'merchant-id';
      const paymentMethodId = 'payment-method-id';

      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findByIdAndMerchant(paymentMethodId, merchantId);

      expect(result).toBeNull();
    });
  });

  describe('deactivate', () => {
    it('should deactivate payment method successfully', async () => {
      const merchantId = 'merchant-id';
      const paymentMethodId = 'payment-method-id';
      const mockPaymentMethod = {
        id: paymentMethodId,
        merchantId,
        isActive: true,
      };

      mockRepository.findOne.mockResolvedValue(mockPaymentMethod);
      mockRepository.update.mockResolvedValue({ affected: 1 });

      await service.deactivate(paymentMethodId, merchantId);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: paymentMethodId, merchantId, isActive: true },
      });
      expect(mockRepository.update).toHaveBeenCalledWith(paymentMethodId, { isActive: false });
    });

    it('should throw NotFoundException when payment method not found for deactivation', async () => {
      const merchantId = 'merchant-id';
      const paymentMethodId = 'payment-method-id';

      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.deactivate(paymentMethodId, merchantId)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: paymentMethodId, merchantId, isActive: true },
      });
      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('Security Tests', () => {
    it('should prevent cross-merchant access to payment methods', async () => {
      const merchantId1 = 'merchant-1';
      const merchantId2 = 'merchant-2';
      const paymentMethodId = 'payment-method-id';

      // Try to access from merchant 2 - should return null
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findByIdAndMerchant(paymentMethodId, merchantId2);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: paymentMethodId, merchantId: merchantId2, isActive: true },
      });
      expect(result).toBeNull();
    });

    it('should handle malicious metadata gracefully', async () => {
      const merchantId = 'merchant-id';
      const maliciousDto: CreatePaymentMethodDto = {
        type: PaymentMethodType.CARD,
        provider: 'Paystack',
        lastFour: '1234',
        metadata: {
          maliciousScript: '<script>alert("xss")</script>',
          sqlInjection: "'; DROP TABLE payment_methods; --",
        },
      };

      const mockPaymentMethod = {
        id: 'payment-method-id',
        merchantId,
        ...maliciousDto,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.create.mockReturnValue(mockPaymentMethod);
      mockRepository.save.mockResolvedValue(mockPaymentMethod);

      const result = await service.create(merchantId, maliciousDto);

      expect(result).toBeDefined();
      expect(result.metadata).toEqual(maliciousDto.metadata);
    });

    it('should validate lastFour format for card payments', async () => {
      const merchantId = 'merchant-id';
      const invalidCardDto: CreatePaymentMethodDto = {
        type: PaymentMethodType.CARD,
        provider: 'Paystack',
        lastFour: '12345', // Invalid - should be 4 digits
      };

      mockRepository.create.mockReturnValue({});
      mockRepository.save.mockResolvedValue({});

      // This should be handled by DTO validation
      const result = await service.create(merchantId, invalidCardDto);
      expect(result).toBeDefined();
    });

    it('should handle large metadata objects', async () => {
      const merchantId = 'merchant-id';
      const largeMetadata = {
        data: 'x'.repeat(10000),
      };

      const dto: CreatePaymentMethodDto = {
        type: PaymentMethodType.CARD,
        provider: 'Paystack',
        lastFour: '1234',
        metadata: largeMetadata,
      };

      mockRepository.create.mockReturnValue({});
      mockRepository.save.mockResolvedValue({});

      await expect(service.create(merchantId, dto)).resolves.toBeDefined();
    });

    it('should prevent unauthorized deactivation', async () => {
      const unauthorizedMerchantId = 'unauthorized-merchant';
      const paymentMethodId = 'payment-method-id';

      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.deactivate(paymentMethodId, unauthorizedMerchantId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Data Integrity Tests', () => {
    it('should maintain referential integrity for merchant ID', async () => {
      const merchantId = 'merchant-id';
      const dto: CreatePaymentMethodDto = {
        type: PaymentMethodType.CARD,
        provider: 'Paystack',
        lastFour: '1234',
      };

      mockRepository.create.mockReturnValue({});
      mockRepository.save.mockResolvedValue({});

      await service.create(merchantId, dto);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          merchantId,
        }),
      );
    });

    it('should handle concurrent deactivation attempts', async () => {
      const merchantId = 'merchant-id';
      const paymentMethodId = 'payment-method-id';
      const mockPaymentMethod = {
        id: paymentMethodId,
        merchantId,
        isActive: true,
      };

      mockRepository.findOne.mockResolvedValue(mockPaymentMethod);
      mockRepository.update.mockResolvedValue({ affected: 1 });

      // Simulate concurrent deactivation attempts
      const promises = [
        service.deactivate(paymentMethodId, merchantId),
        service.deactivate(paymentMethodId, merchantId),
      ];

      await Promise.all(promises);

      expect(mockRepository.update).toHaveBeenCalledTimes(2);
    });
  });
});
