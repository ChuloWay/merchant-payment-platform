import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let service: PaymentsService;
  let guard: ApiKeyGuard;

  const mockPaymentsService = {
    initializePayment: jest.fn(),
    findById: jest.fn(),
    findByReference: jest.fn(),
    findByMerchant: jest.fn(),
  };

  const mockApiKeyGuard = {
    canActivate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: PaymentsService,
          useValue: mockPaymentsService,
        },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue(mockApiKeyGuard)
      .compile();

    controller = module.get<PaymentsController>(PaymentsController);
    service = module.get<PaymentsService>(PaymentsService);
    guard = module.get<ApiKeyGuard>(ApiKeyGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initializePayment', () => {
    const initializePaymentDto: InitializePaymentDto = {
      amount: 25000.0,
      currency: 'NGN',
      paymentMethodId: 'payment-method-id',
      metadata: {
        customerId: 'CUST-001',
        orderId: 'ORDER-001',
      },
    };

    const mockRequest = {
      merchant: {
        id: 'merchant-id',
        name: 'Test Merchant',
      },
    };

    it('should initialize payment successfully', async () => {
      const mockPayment = {
        id: 'payment-id',
        reference: 'PAY-TEST-123',
        amount: 25000.0,
        currency: 'NGN',
        status: 'pending',
        merchantId: 'merchant-id',
        paymentMethodId: 'payment-method-id',
        metadata: initializePaymentDto.metadata,
        initiatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPaymentsService.initializePayment.mockResolvedValue(mockPayment);

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const mockNext = jest.fn();

      await controller.initializePayment(
        mockRes as any,
        mockRequest as any,
        mockNext,
        initializePaymentDto,
      );

      expect(mockPaymentsService.initializePayment).toHaveBeenCalledWith(
        'merchant-id',
        initializePaymentDto,
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        statusCode: 201,
        data: mockPayment,
        message: 'Payment initialized successfully',
      });
    });

    it('should handle service errors', async () => {
      const error = new NotFoundException('Payment method not found');
      mockPaymentsService.initializePayment.mockRejectedValue(error);

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const mockNext = jest.fn();

      await controller.initializePayment(
        mockRes as any,
        mockRequest as any,
        mockNext,
        initializePaymentDto,
      );

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getPayment', () => {
    it('should return payment by ID', async () => {
      const paymentId = 'payment-id';
      const mockPayment = {
        id: paymentId,
        reference: 'PAY-TEST-123',
        amount: 25000.0,
        status: 'pending',
      };

      mockPaymentsService.findById.mockResolvedValue(mockPayment);

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const mockNext = jest.fn();

      await controller.getPayment(mockRes as any, mockNext, paymentId);

      expect(mockPaymentsService.findById).toHaveBeenCalledWith(paymentId);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        statusCode: 200,
        data: mockPayment,
        message: 'Payment retrieved successfully',
      });
    });

    it('should handle payment not found', async () => {
      const paymentId = 'non-existent-id';
      const error = new NotFoundException('Payment not found');
      mockPaymentsService.findById.mockRejectedValue(error);

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const mockNext = jest.fn();

      await controller.getPayment(mockRes as any, mockNext, paymentId);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getPaymentByReference', () => {
    it('should return payment by reference', async () => {
      const reference = 'PAY-TEST-123';
      const mockPayment = {
        id: 'payment-id',
        reference,
        amount: 25000.0,
        status: 'pending',
      };

      mockPaymentsService.findByReference.mockResolvedValue(mockPayment);

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const mockNext = jest.fn();

      await controller.getPaymentByReference(mockRes as any, mockNext, reference);

      expect(mockPaymentsService.findByReference).toHaveBeenCalledWith(reference);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        statusCode: 200,
        data: mockPayment,
        message: 'Payment retrieved successfully',
      });
    });
  });

  describe('getPayments', () => {
    const mockRequest = {
      merchant: {
        id: 'merchant-id',
        name: 'Test Merchant',
      },
    };

    it('should return merchant payments with pagination', async () => {
      const mockPayments = [
        {
          id: 'payment-1',
          reference: 'PAY-001',
          amount: 10000,
          status: 'completed',
        },
        {
          id: 'payment-2',
          reference: 'PAY-002',
          amount: 20000,
          status: 'pending',
        },
      ];

      mockPaymentsService.findByMerchant.mockResolvedValue(mockPayments);

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const mockNext = jest.fn();

      await controller.getPayments(mockRes as any, mockRequest as any, mockNext, 10, 0);

      expect(mockPaymentsService.findByMerchant).toHaveBeenCalledWith('merchant-id', 10, 0);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        statusCode: 200,
        data: mockPayments,
        message: 'Payments retrieved successfully',
      });
    });

    it('should use default pagination values', async () => {
      const mockPayments = [];
      mockPaymentsService.findByMerchant.mockResolvedValue(mockPayments);

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const mockNext = jest.fn();

      await controller.getPayments(mockRes as any, mockRequest as any, mockNext);

      expect(mockPaymentsService.findByMerchant).toHaveBeenCalledWith('merchant-id', 50, 0);
    });
  });
});
