import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { MerchantsService } from '../../modules/merchants/merchants.service';

// Mock functions for testing
const createMockExecutionContext = (url: string, headers: any = {}) => ({
  switchToHttp: () => ({
    getRequest: () => ({
      url,
      headers,
    }),
  }),
  getHandler: () => 'testHandler',
  getClass: () => 'TestController',
  getArgs: () => [],
  getArgByIndex: (index: number) => undefined,
  switchToRpc: () => ({ getContext: () => ({}) }),
  switchToWs: () => ({ getClient: () => ({}), getData: () => ({}) }),
  getType: () => 'http',
} as unknown as ExecutionContext);

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let merchantsService: MerchantsService;

  const mockMerchantsService = {
    findByApiKey: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        {
          provide: MerchantsService,
          useValue: mockMerchantsService,
        },
      ],
    }).compile();

    guard = module.get<ApiKeyGuard>(ApiKeyGuard);
    merchantsService = module.get<MerchantsService>(MerchantsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    const createMockExecutionContext = (url: string, headers: Record<string, string> = {}) => {
      return {
        switchToHttp: () => ({
          getRequest: () => ({
            url,
            headers,
          }),
        }),
      } as ExecutionContext;
    };

    it('should allow access to health endpoint without API key', async () => {
      const context = createMockExecutionContext('/api/v1/health');

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockMerchantsService.findByApiKey).not.toHaveBeenCalled();
    });

    it('should allow access to docs endpoint without API key', async () => {
      const context = createMockExecutionContext('/api/v1/docs');

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockMerchantsService.findByApiKey).not.toHaveBeenCalled();
    });

    it('should allow access to merchants endpoint without API key', async () => {
      const context = createMockExecutionContext('/api/v1/merchants');

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockMerchantsService.findByApiKey).not.toHaveBeenCalled();
    });

    it('should allow access to merchants endpoint with query params', async () => {
      const context = createMockExecutionContext('/api/v1/merchants?limit=10&offset=0');

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockMerchantsService.findByApiKey).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when API key is missing for protected endpoints', async () => {
      const context = createMockExecutionContext('/api/v1/payments');

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      expect(mockMerchantsService.findByApiKey).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when API key is empty', async () => {
      const context = createMockExecutionContext('/api/v1/payments', {
        'x-api-key': '',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      expect(mockMerchantsService.findByApiKey).not.toHaveBeenCalled();
    });

    it('should validate valid API key successfully', async () => {
      const apiKey = 'pk_test_valid_key';
      const mockMerchant = {
        id: 'merchant-id',
        name: 'Test Merchant',
        apiKey,
        isActive: true,
      };

      mockMerchantsService.findByApiKey.mockResolvedValue(mockMerchant);

      const context = createMockExecutionContext('/api/v1/payments', {
        'x-api-key': apiKey,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockMerchantsService.findByApiKey).toHaveBeenCalledWith(apiKey, true);
    });

    it('should throw UnauthorizedException for invalid API key', async () => {
      const apiKey = 'pk_test_invalid_key';
      mockMerchantsService.findByApiKey.mockResolvedValue(null);

      const context = createMockExecutionContext('/api/v1/payments', {
        'x-api-key': apiKey,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      expect(mockMerchantsService.findByApiKey).toHaveBeenCalledWith(apiKey, true);
    });

    it('should throw UnauthorizedException for inactive merchant', async () => {
      const apiKey = 'pk_test_inactive_key';
      const inactiveMerchant = {
        id: 'merchant-id',
        name: 'Inactive Merchant',
        apiKey,
        isActive: false,
      };

      mockMerchantsService.findByApiKey.mockResolvedValue(inactiveMerchant);

      const context = createMockExecutionContext('/api/v1/payments', {
        'x-api-key': apiKey,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      expect(mockMerchantsService.findByApiKey).toHaveBeenCalledWith(apiKey, true);
    });

    it('should handle service errors gracefully', async () => {
      const apiKey = 'pk_test_error_key';
      mockMerchantsService.findByApiKey.mockRejectedValue(new Error('Database error'));

      const context = createMockExecutionContext('/api/v1/payments', {
        'x-api-key': apiKey,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      expect(mockMerchantsService.findByApiKey).toHaveBeenCalledWith(apiKey, true);
    });

    it('should handle case-insensitive API key header', async () => {
      const apiKey = 'pk_test_case_insensitive';
      const mockMerchant = {
        id: 'merchant-id',
        name: 'Test Merchant',
        apiKey,
        isActive: true,
      };

      mockMerchantsService.findByApiKey.mockResolvedValue(mockMerchant);

      const context = createMockExecutionContext('/api/v1/payments', {
        'X-API-KEY': apiKey,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockMerchantsService.findByApiKey).toHaveBeenCalledWith(apiKey, true);
    });

    it('should handle multiple API key headers', async () => {
      const apiKey = 'pk_test_multiple_headers';
      const mockMerchant = {
        id: 'merchant-id',
        name: 'Test Merchant',
        apiKey,
        isActive: true,
      };

      mockMerchantsService.findByApiKey.mockResolvedValue(mockMerchant);

      const context = createMockExecutionContext('/api/v1/payments', {
        'x-api-key': apiKey,
        'X-API-KEY': 'duplicate-key',
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockMerchantsService.findByApiKey).toHaveBeenCalledWith(apiKey, true);
    });
  });

  describe('Security Tests', () => {
    it('should handle SQL injection attempts in API key', async () => {
      const maliciousApiKey = "'; DROP TABLE merchants; --";
      mockMerchantsService.findByApiKey.mockResolvedValue(null);

      const context = createMockExecutionContext('/api/v1/payments', {
        'x-api-key': maliciousApiKey,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      expect(mockMerchantsService.findByApiKey).toHaveBeenCalledWith(maliciousApiKey, true);
    });

    it('should handle very long API keys', async () => {
      const longApiKey = 'pk_' + 'a'.repeat(1000);
      mockMerchantsService.findByApiKey.mockResolvedValue(null);

      const context = createMockExecutionContext('/api/v1/payments', {
        'x-api-key': longApiKey,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      expect(mockMerchantsService.findByApiKey).toHaveBeenCalledWith(longApiKey, true);
    });

    it('should handle special characters in API key', async () => {
      const specialApiKey = 'pk_test_!@#$%^&*()_+-=[]{}|;:,.<>?';
      mockMerchantsService.findByApiKey.mockResolvedValue(null);

      const context = createMockExecutionContext('/api/v1/payments', {
        'x-api-key': specialApiKey,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      expect(mockMerchantsService.findByApiKey).toHaveBeenCalledWith(specialApiKey, true);
    });

    it('should handle concurrent authentication requests', async () => {
      const apiKey = 'pk_test_concurrent';
      const mockMerchant = {
        id: 'merchant-id',
        name: 'Test Merchant',
        apiKey,
        isActive: true,
      };

      mockMerchantsService.findByApiKey.mockResolvedValue(mockMerchant);

      const context = createMockExecutionContext('/api/v1/payments', {
        'x-api-key': apiKey,
      });

      // Simulate concurrent requests
      const promises = [
        guard.canActivate(context),
        guard.canActivate(context),
        guard.canActivate(context),
      ];

      const results = await Promise.all(promises);

      expect(results).toEqual([true, true, true]);
      expect(mockMerchantsService.findByApiKey).toHaveBeenCalledTimes(3);
    });
  });
});
