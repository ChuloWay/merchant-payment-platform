import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { CorrelationIdInterceptor } from './correlation-id.interceptor';

// Mock functions for testing
const createMockExecutionContext = (request: any = {}) => ({
  switchToHttp: () => ({
    getRequest: () => ({
      method: 'GET',
      url: '/api/v1/test',
      headers: {},
      ip: '127.0.0.1',
      ...request,
    }),
    getResponse: () => ({
      setHeader: jest.fn(),
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

const createMockCallHandler = () => ({
  handle: () => of({ data: 'test' }),
});
import { v4 as uuidv4 } from 'uuid';

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mocked-correlation-id'),
}));

describe('CorrelationIdInterceptor', () => {
  let interceptor: CorrelationIdInterceptor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CorrelationIdInterceptor],
    }).compile();

    interceptor = module.get<CorrelationIdInterceptor>(CorrelationIdInterceptor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('intercept', () => {
    const createMockExecutionContext = (headers: Record<string, string> = {}) => {
      return {
        switchToHttp: () => ({
          getRequest: () => ({
            headers,
          }),
        }),
      } as ExecutionContext;
    };

    const createMockCallHandler = (returnValue: any = { data: 'test' }) => {
      return {
        handle: () => of(returnValue),
      } as CallHandler;
    };

    it('should generate correlation ID when not present in headers', (done) => {
      const context = createMockExecutionContext();
      const handler = createMockCallHandler();

      interceptor.intercept(context, handler).subscribe({
        next: (result) => {
          expect(uuidv4).toHaveBeenCalled();
          expect(result).toEqual({ data: 'test' });
          done();
        },
        error: done,
      });
    });

    it('should use existing correlation ID from headers', (done) => {
      const existingCorrelationId = 'existing-correlation-id';
      const context = createMockExecutionContext({
        'x-correlation-id': existingCorrelationId,
      });
      const handler = createMockCallHandler();

      interceptor.intercept(context, handler).subscribe({
        next: (result) => {
          expect(uuidv4).not.toHaveBeenCalled();
          expect(result).toEqual({ data: 'test' });
          done();
        },
        error: done,
      });
    });

    it('should handle case-insensitive correlation ID header', (done) => {
      const existingCorrelationId = 'existing-correlation-id';
      const context = createMockExecutionContext({
        'X-Correlation-ID': existingCorrelationId,
      });
      const handler = createMockCallHandler();

      interceptor.intercept(context, handler).subscribe({
        next: (result) => {
          expect(uuidv4).not.toHaveBeenCalled();
          expect(result).toEqual({ data: 'test' });
          done();
        },
        error: done,
      });
    });

    it('should handle multiple correlation ID headers', (done) => {
      const existingCorrelationId = 'existing-correlation-id';
      const context = createMockExecutionContext({
        'x-correlation-id': existingCorrelationId,
        'X-Correlation-ID': 'duplicate-id',
      });
      const handler = createMockCallHandler();

      interceptor.intercept(context, handler).subscribe({
        next: (result) => {
          expect(uuidv4).not.toHaveBeenCalled();
          expect(result).toEqual({ data: 'test' });
          done();
        },
        error: done,
      });
    });

    it('should handle empty correlation ID header', (done) => {
      const context = createMockExecutionContext({
        'x-correlation-id': '',
      });
      const handler = createMockCallHandler();

      interceptor.intercept(context, handler).subscribe({
        next: (result) => {
          expect(uuidv4).toHaveBeenCalled();
          expect(result).toEqual({ data: 'test' });
          done();
        },
        error: done,
      });
    });

    it('should handle handler errors', (done) => {
      const context = createMockExecutionContext();
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
          done();
        },
      });
    });

    it('should handle async handler responses', (done) => {
      const context = createMockExecutionContext();
      const handler = {
        handle: () => of({ data: 'async-test' }),
      } as CallHandler;

      interceptor.intercept(context, handler).subscribe({
        next: (result) => {
          expect(result).toEqual({ data: 'async-test' });
          done();
        },
        error: done,
      });
    });

    it('should preserve request context', (done) => {
      const context = createMockExecutionContext({
        'user-agent': 'test-agent',
        'content-type': 'application/json',
      });
      const handler = createMockCallHandler();

      interceptor.intercept(context, handler).subscribe({
        next: (result) => {
          expect(result).toEqual({ data: 'test' });
          done();
        },
        error: done,
      });
    });
  });

  describe('Security Tests', () => {
    it('should handle malicious correlation ID values', (done) => {
      const maliciousCorrelationId = '<script>alert("xss")</script>';
      const context = createMockExecutionContext({
        'x-correlation-id': maliciousCorrelationId,
      });
      const handler = createMockCallHandler();

      interceptor.intercept(context, handler).subscribe({
        next: (result) => {
          expect(uuidv4).not.toHaveBeenCalled();
          expect(result).toEqual({ data: 'test' });
          done();
        },
        error: done,
      });
    });

    it('should handle very long correlation ID values', (done) => {
      const longCorrelationId = 'a'.repeat(10000);
      const context = createMockExecutionContext({
        'x-correlation-id': longCorrelationId,
      });
      const handler = createMockCallHandler();

      interceptor.intercept(context, handler).subscribe({
        next: (result) => {
          expect(uuidv4).not.toHaveBeenCalled();
          expect(result).toEqual({ data: 'test' });
          done();
        },
        error: done,
      });
    });

    it('should handle special characters in correlation ID', (done) => {
      const specialCorrelationId = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const context = createMockExecutionContext({
        'x-correlation-id': specialCorrelationId,
      });
      const handler = createMockCallHandler();

      interceptor.intercept(context, handler).subscribe({
        next: (result) => {
          expect(uuidv4).not.toHaveBeenCalled();
          expect(result).toEqual({ data: 'test' });
          done();
        },
        error: done,
      });
    });
  });
});
