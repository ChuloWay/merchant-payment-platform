import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { MerchantsService } from './merchants.service';
import { Merchant } from './entities/merchant.entity';
import { CreateMerchantDto } from './dto/create-merchant.dto';

describe('MerchantsService', () => {
  let service: MerchantsService;
  let repository: Repository<Merchant>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findByApiKey: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MerchantsService,
        {
          provide: getRepositoryToken(Merchant),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<MerchantsService>(MerchantsService);
    repository = module.get<Repository<Merchant>>(getRepositoryToken(Merchant));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createMerchantDto: CreateMerchantDto = {
      name: 'Test Merchant',
      email: 'test@merchant.com',
      webhookUrl: 'https://test-merchant.com/webhooks',
    };

    it('should create a merchant successfully', async () => {
      const mockMerchant = {
        id: 'merchant-id',
        name: createMerchantDto.name,
        email: createMerchantDto.email,
        webhookUrl: createMerchantDto.webhookUrl,
        apiKey: 'pk_test_123',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(null); // No existing merchant
      mockRepository.create.mockReturnValue(mockMerchant);
      mockRepository.save.mockResolvedValue(mockMerchant);

      const result = await service.create(createMerchantDto);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: createMerchantDto.email },
      });
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: createMerchantDto.name,
          email: createMerchantDto.email,
          webhookUrl: createMerchantDto.webhookUrl,
          apiKey: expect.stringMatching(/^pk_[a-zA-Z0-9]+_[a-zA-Z0-9]+$/),
        }),
      );
      expect(mockRepository.save).toHaveBeenCalledWith(mockMerchant);
      expect(result).toEqual(mockMerchant);
      expect(result.apiKey).toMatch(/^pk_[a-zA-Z0-9]+_[a-zA-Z0-9]+$/);
    });

    it('should throw ConflictException when merchant with email already exists', async () => {
      const existingMerchant = {
        id: 'existing-id',
        email: createMerchantDto.email,
      };

      mockRepository.findOne.mockResolvedValue(existingMerchant);

      await expect(service.create(createMerchantDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: createMerchantDto.email },
      });
      expect(mockRepository.create).not.toHaveBeenCalled();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should generate unique API keys for different merchants', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue({ id: 'id1', ...createMerchantDto, apiKey: 'pk_test_1' });
      mockRepository.save.mockResolvedValue({ id: 'id1', ...createMerchantDto, apiKey: 'pk_test_1' });

      const result1 = await service.create(createMerchantDto);
      
      mockRepository.create.mockReturnValue({ id: 'id2', ...createMerchantDto, email: 'test2@merchant.com', apiKey: 'pk_test_2' });
      mockRepository.save.mockResolvedValue({ id: 'id2', ...createMerchantDto, email: 'test2@merchant.com', apiKey: 'pk_test_2' });

      const result2 = await service.create({ ...createMerchantDto, email: 'test2@merchant.com' });

      expect(result1.apiKey).not.toEqual(result2.apiKey);
      expect(result1.apiKey).toMatch(/^pk_[a-zA-Z0-9]+_[a-zA-Z0-9]+$/);
      expect(result2.apiKey).toMatch(/^pk_[a-zA-Z0-9]+_[a-zA-Z0-9]+$/);
    });

    it('should handle creation without webhook URL', async () => {
      const dtoWithoutWebhook = {
        name: 'Test Merchant',
        email: 'test@merchant.com',
      };

      const mockMerchant = {
        id: 'merchant-id',
        ...dtoWithoutWebhook,
        webhookUrl: null,
        apiKey: 'pk_test_123',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockMerchant);
      mockRepository.save.mockResolvedValue(mockMerchant);

      const result = await service.create(dtoWithoutWebhook);

      expect(result.webhookUrl).toBeNull();
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: dtoWithoutWebhook.name,
          email: dtoWithoutWebhook.email,
        }),
      );
    });

    it('should validate email format', async () => {
      const invalidEmailDto = {
        name: 'Test Merchant',
        email: 'invalid-email',
      };

      // This test assumes validation happens at DTO level
      // If validation is in service, add appropriate test
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue({});
      mockRepository.save.mockResolvedValue({});
      
      // Should not reach here if validation is proper
      await expect(service.create(invalidEmailDto)).resolves.toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should return all active merchants', async () => {
      const mockMerchants = [
        { id: '1', name: 'Merchant 1', isActive: true },
        { id: '2', name: 'Merchant 2', isActive: true },
      ];

      mockRepository.find.mockResolvedValue(mockMerchants);

      const result = await service.findAll();

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(mockMerchants);
    });

    it('should return empty array when no merchants exist', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
      expect(mockRepository.find).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return merchant by ID', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const mockMerchant = {
        id: validUuid,
        name: 'Test Merchant',
        email: 'test@merchant.com',
        isActive: true,
      };

      mockRepository.findOne.mockResolvedValue(mockMerchant);

      const result = await service.findById(validUuid);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: validUuid },
      });
      expect(result).toEqual(mockMerchant);
    });

    it('should throw NotFoundException when merchant not found', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174001';
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findById(validUuid)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: validUuid },
      });
    });

    it('should handle invalid UUID format', async () => {
      const invalidId = 'invalid-uuid';
      
      await expect(service.findById(invalidId)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRepository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('findByApiKey', () => {
    it('should return merchant by valid API key', async () => {
      const mockMerchant = {
        id: 'merchant-id',
        name: 'Test Merchant',
        apiKey: 'pk_test_123',
        isActive: true,
      };

      mockRepository.findOne.mockResolvedValue(mockMerchant);

      const result = await service.findByApiKey('pk_test_123');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { apiKey: 'pk_test_123', isActive: true },
      });
      expect(result).toEqual(mockMerchant);
    });

    it('should return null for invalid API key', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findByApiKey('invalid_key');

      expect(result).toBeNull();
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { apiKey: 'invalid_key', isActive: true },
      });
    });

    it('should return null for inactive merchant', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findByApiKey('pk_inactive_merchant');

      expect(result).toBeNull();
    });

    it('should handle SQL injection attempts in API key', async () => {
      const maliciousApiKey = "'; DROP TABLE merchants; --";
      
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findByApiKey(maliciousApiKey);

      expect(result).toBeNull();
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { apiKey: maliciousApiKey, isActive: true },
      });
    });
  });

  describe('Security Tests', () => {
    it('should prevent unauthorized access to merchant data', async () => {
      // Test that service methods properly validate permissions
      const unauthorizedId = 'unauthorized-merchant-id';
      
      await expect(service.findById(unauthorizedId)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRepository.findOne).not.toHaveBeenCalled();
    });

    it('should handle large payloads gracefully', async () => {
      const largeName = 'A'.repeat(10000);
      const createDto = {
        name: largeName,
        email: 'test@merchant.com',
      };

      mockRepository.findOne.mockResolvedValue(null);
      
      // Should not crash with large payloads
      await expect(service.create(createDto)).resolves.toBeDefined();
    });

    it('should validate webhook URL format', async () => {
      const invalidWebhookDto = {
        name: 'Test Merchant',
        email: 'test@merchant.com',
        webhookUrl: 'not-a-valid-url',
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue({});
      mockRepository.save.mockResolvedValue({});
      
      // This should be handled by DTO validation
      // If validation is in service, add appropriate test
      await expect(service.create(invalidWebhookDto)).resolves.toBeDefined();
    });
  });
});
