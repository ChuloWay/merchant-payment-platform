import { Test, TestingModule } from '@nestjs/testing';
import { MerchantsController } from './merchants.controller';
import { MerchantsService } from './merchants.service';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('MerchantsController', () => {
  let controller: MerchantsController;
  let service: MerchantsService;

  const mockMerchantsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MerchantsController],
      providers: [
        {
          provide: MerchantsService,
          useValue: mockMerchantsService,
        },
      ],
    }).compile();

    controller = module.get<MerchantsController>(MerchantsController);
    service = module.get<MerchantsService>(MerchantsService);
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
        ...createMerchantDto,
        apiKey: 'pk_test_123',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockMerchantsService.create.mockResolvedValue(mockMerchant);

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const mockNext = jest.fn();

      await controller.create(mockRes as any, mockNext, createMerchantDto);

      expect(mockMerchantsService.create).toHaveBeenCalledWith(createMerchantDto);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        statusCode: 201,
        data: mockMerchant,
        message: 'Merchant created successfully',
      });
    });

    it('should handle service errors', async () => {
      const error = new ConflictException('Merchant with this email already exists');
      mockMerchantsService.create.mockRejectedValue(error);

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const mockNext = jest.fn();

      await controller.create(mockRes as any, mockNext, createMerchantDto);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('findAll', () => {
    it('should return all merchants', async () => {
      const mockMerchants = [
        {
          id: 'merchant-1',
          name: 'Merchant 1',
          email: 'merchant1@test.com',
          isActive: true,
        },
        {
          id: 'merchant-2',
          name: 'Merchant 2',
          email: 'merchant2@test.com',
          isActive: true,
        },
      ];

      mockMerchantsService.findAll.mockResolvedValue(mockMerchants);

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const mockNext = jest.fn();

      await controller.findAll(mockRes as any, mockNext);

      expect(mockMerchantsService.findAll).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        statusCode: 200,
        data: mockMerchants,
        message: 'Merchants retrieved successfully',
      });
    });

    it('should handle service errors', async () => {
      const error = new Error('Database connection failed');
      mockMerchantsService.findAll.mockRejectedValue(error);

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const mockNext = jest.fn();

      await controller.findAll(mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('findOne', () => {
    it('should return a specific merchant', async () => {
      const merchantId = 'merchant-id';
      const mockMerchant = {
        id: merchantId,
        name: 'Test Merchant',
        email: 'test@merchant.com',
        isActive: true,
      };

      mockMerchantsService.findById.mockResolvedValue(mockMerchant);

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const mockNext = jest.fn();

      await controller.findOne(mockRes as any, mockNext, merchantId);

      expect(mockMerchantsService.findById).toHaveBeenCalledWith(merchantId);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        statusCode: 200,
        data: mockMerchant,
        message: 'Merchant retrieved successfully',
      });
    });

    it('should handle merchant not found', async () => {
      const merchantId = 'non-existent-id';
      const error = new NotFoundException('Merchant not found');
      mockMerchantsService.findById.mockRejectedValue(error);

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const mockNext = jest.fn();

      await controller.findOne(mockRes as any, mockNext, merchantId);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
