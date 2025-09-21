import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { of } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

// Mock functions for testing
const createMockExecutionContext = (method: string, url: string, headers: any = {}) => ({
  switchToHttp: () => ({
    getRequest: () => ({
      method,
      url,
      headers,
      ip: '127.0.0.1',
      correlationId: 'test-correlation-id',
    }),
    getResponse: () => ({
      statusCode: 200,
      getHeader: jest.fn(),
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

const createMockCallHandler = (data: any) => ({
  handle: () => of(data),
});

// Mock Logger
jest.mock('@nestjs/common', () => ({
  ...jest.requireActual('@nestjs/common'),
  Logger: jest.fn().mockImplementation(() => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoggingInterceptor],
    }).compile();

    interceptor = module.get<LoggingInterceptor>(LoggingInterceptor);
    mockLogger = (interceptor as any).logger;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('intercept', () => {
    const createMockExecutionContext = (
      method: string = 'GET',
      url: string = '/api/v1/test',
      headers: Record<string, string> = {},
      body: any = {},
    ) => {
      return {
        switchToHttp: () => ({
          getRequest: () => ({
            method,
            url,
            headers,
            body,
          }),
          getResponse: () => ({
            statusCode: 200,
          }),
        }),
        getHandler: () => ({
          name: 'TestHandler',
        }),
      } as ExecutionContext;
    };

    const createMockCallHandler = (returnValue: any = { data: 'test' }) => {
      return {
        handle: () => of(returnValue),
      } as CallHandler;
    };

    it('should log request and response for successful requests', (done) => {
      const context = createMockExecutionContext('POST', '/api/v1/payments', {
        'x-api-key': 'pk_test_123',
        'content-type': 'application/json',
      }, { amount: 25000 });
      const handler = createMockCallHandler({ id: 'payment-123' });

      interceptor.intercept(context, handler).subscribe({
        next: (result) => {
          expect(mockLogger.log).toHaveBeenCalledWith(
            expect.stringContaining('POST /api/v1/payments'),
          );
          expect(mockLogger.log).toHaveBeenCalledWith(
            expect.stringContaining('Response: 200'),
          );
          expect(result).toEqual({ id: 'payment-123' });
          done();
        },
        error: done,
      });
    });

    it('should log request and response for GET requests', (done) => {
      const context = createMockExecutionContext('GET', '/api/v1/merchants');
      const handler = createMockCallHandler({ merchants: [] });

      interceptor.intercept(context, handler).subscribe({
        next: (result) => {
          expect(mockLogger.log).toHaveBeenCalledWith(
            expect.stringContaining('GET /api/v1/merchants'),
          );
          expect(result).toEqual({ merchants: [] });
          done();
        },
        error: done,
      });
    });

    it('should handle requests without API key', (done) => {
      const context = createMockExecutionContext('GET', '/api/v1/health');
      const handler = createMockCallHandler({ status: 'ok' });

      interceptor.intercept(context, handler).subscribe({
        next: (result) => {
          expect(mockLogger.log).toHaveBeenCalledWith(
            expect.stringContaining('GET /api/v1/health'),
          );
          expect(result).toEqual({ status: 'ok' });
          done();
        },
        error: done,
      });
    });

    it('should handle requests with large payloads', (done) => {
      const largeBody = {
        data: 'x'.repeat(10000),
        nested: {
          deep: {
            object: 'with lots of data',
          },
        },
      };

      const context = createMockExecutionContext('POST', '/api/v1/payments', {
        'content-type': 'application/json',
      }, largeBody);
      const handler = createMockCallHandler({ success: true });

      interceptor.intercept(context, handler).subscribe({
        next: (result) => {
          expect(mockLogger.log).toHaveBeenCalledWith(
            expect.stringContaining('POST /api/v1/payments'),
          );
          expect(result).toEqual({ success: true });
          done();
        },
        error: done,
      });
    });

    it('should handle handler errors', (done) => {
      const context = createMockExecutionContext('POST', '/api/v1/payments');
      const handler = {
        handle: () => {
          throw new Error('Handler error');
        },
      } as CallHandler;

      interceptor.intercept(context, handler).subscribe({
        next: () => {
          done(new Error('Should have thrown'));
        },
        error: (error) => {
          expect(error.message).toBe('Handler error');
          expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('Handler error'),
            expect.any(String),
          );
          done();
        },
      });
    });

    it('should handle async handler responses', (done) => {
      const context = createMockExecutionContext('GET', '/api/v1/merchants');
      const handler = {
        handle: () => of({ merchants: [] }),
      } as CallHandler;

      interceptor.intercept(context, handler).subscribe({
        next: (result) => {
          expect(mockLogger.log).toHaveBeenCalledWith(
            expect.stringContaining('GET /api/v1/merchants'),
          );
          expect(result).toEqual({ merchants: [] });
          done();
        },
        error: done,
      });
    });

    it('should handle different HTTP methods', (done) => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      let completedCount = 0;

      methods.forEach((method) => {
        const context = createMockExecutionContext(method, `/api/v1/test-${method.toLowerCase()}`);
        const handler = createMockCallHandler({ method });

        interceptor.intercept(context, handler).subscribe({
          next: (result) => {
            expect(mockLogger.log).toHaveBeenCalledWith(
              expect.stringContaining(`${method} /api/v1/test-${method.toLowerCase()}`),
            );
            completedCount++;
            if (completedCount === methods.length) {
              done();
            }
          },
          error: done,
        });
      });
    });

    it('should handle requests with query parameters', (done) => {
      const context = createMockExecutionContext('GET', '/api/v1/payments?limit=10&offset=0');
      const handler = createMockCallHandler({ payments: [] });

      interceptor.intercept(context, handler).subscribe({
        next: (result) => {
          expect(mockLogger.log).toHaveBeenCalledWith(
            expect.stringContaining('GET /api/v1/payments'),
          );
          expect(result).toEqual({ payments: [] });
          done();
        },
        error: done,
      });
    });

    it('should handle requests with different content types', (done) => {
      const contentTypes = [
        'application/json',
        'application/x-www-form-urlencoded',
        'multipart/form-data',
        'text/plain',
      ];
      let completedCount = 0;

      contentTypes.forEach((contentType) => {
        const context = createMockExecutionContext('POST', '/api/v1/test', {
          'content-type': contentType,
        });
        const handler = createMockCallHandler({ contentType });

        interceptor.intercept(context, handler).subscribe({
          next: (result) => {
            expect(mockLogger.log).toHaveBeenCalledWith(
              expect.stringContaining('POST /api/v1/test'),
            );
            completedCount++;
            if (completedCount === contentTypes.length) {
              done();
            }
          },
          error: done,
        });
      });
    });
  });

  describe('Security Tests', () => {
    it('should handle malicious request data', (done) => {
      const maliciousBody = {
        xssPayload: '<script>alert("xss")</script>',
        sqlInjection: "'; DROP TABLE users; --",
        maliciousData: 'x'.repeat(100000),
      };

      const context = createMockExecutionContext('POST', '/api/v1/payments', {
        'content-type': 'application/json',
      });
      const handler = createMockCallHandler({ success: true });

      interceptor.intercept(context, handler).subscribe({
        next: (result) => {
          expect(mockLogger.log).toHaveBeenCalledWith(
            expect.stringContaining('POST /api/v1/payments'),
          );
          expect(result).toEqual({ success: true });
          done();
        },
        error: done,
      });
    });

    it('should handle malicious headers', (done) => {
      const maliciousHeaders = {
        'x-api-key': 'pk_test_123',
        'x-malicious-header': '<script>alert("xss")</script>',
        'user-agent': 'malicious-agent',
      };

      const context = createMockExecutionContext('GET', '/api/v1/merchants', maliciousHeaders);
      const handler = createMockCallHandler({ merchants: [] });

      interceptor.intercept(context, handler).subscribe({
        next: (result) => {
          expect(mockLogger.log).toHaveBeenCalledWith(
            expect.stringContaining('GET /api/v1/merchants'),
          );
          expect(result).toEqual({ merchants: [] });
          done();
        },
        error: done,
      });
    });

    it('should handle very long URLs', (done) => {
      const longUrl = '/api/v1/' + 'a'.repeat(10000);
      const context = createMockExecutionContext('GET', longUrl);
      const handler = createMockCallHandler({ data: 'test' });

      interceptor.intercept(context, handler).subscribe({
        next: (result) => {
          expect(mockLogger.log).toHaveBeenCalledWith(
            expect.stringContaining('GET /api/v1/'),
          );
          expect(result).toEqual({ data: 'test' });
          done();
        },
        error: done,
      });
    });

    it('should handle concurrent requests', (done) => {
      const contexts = Array(10).fill(null).map((_, index) =>
        createMockExecutionContext('GET', `/api/v1/test-${index}`)
      );
      const handlers = Array(10).fill(null).map((_, index) =>
        createMockCallHandler({ index })
      );

      let completedCount = 0;
      const totalRequests = contexts.length;

      contexts.forEach((context, index) => {
        interceptor.intercept(context, handlers[index]).subscribe({
          next: (result) => {
            expect(mockLogger.log).toHaveBeenCalledWith(
              expect.stringContaining(`GET /api/v1/test-${index}`),
            );
            completedCount++;
            if (completedCount === totalRequests) {
              done();
            }
          },
          error: done,
        });
      });
    });
  });
});
