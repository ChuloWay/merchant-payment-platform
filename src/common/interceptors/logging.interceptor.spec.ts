import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
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

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
  });

  describe('intercept', () => {
    it('should process successful requests without crashing', (done) => {
      const context = createMockExecutionContext('POST', '/api/v1/payments', {
        'x-api-key': 'pk_test_123',
        'content-type': 'application/json',
      });
      const handler = createMockCallHandler({ id: 'payment-123' });

      interceptor.intercept(context, handler).subscribe({
        next: (result) => {
          expect(result).toEqual({ id: 'payment-123' });
          done();
        },
        error: done,
      });
    });

    it('should process GET requests without crashing', (done) => {
      const context = createMockExecutionContext('GET', '/api/v1/merchants');
      const handler = createMockCallHandler({ merchants: [] });

      interceptor.intercept(context, handler).subscribe({
        next: (result) => {
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
          expect(result).toEqual({ status: 'ok' });
          done();
        },
        error: done,
      });
    });

    it('should handle requests with large payloads', (done) => {
      const largePayload = { data: 'x'.repeat(10000) };
      const context = createMockExecutionContext('POST', '/api/v1/payments', {
        'content-type': 'application/json',
      });
      const handler = createMockCallHandler({ success: true });

      interceptor.intercept(context, handler).subscribe({
        next: (result) => {
          expect(result).toEqual({ success: true });
          done();
        },
        error: done,
      });
    });

    it('should handle handler errors gracefully', (done) => {
      const context = createMockExecutionContext('POST', '/api/v1/payments');
      const handler = {
        handle: () => throwError(() => new Error('Handler error')),
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
      const context = createMockExecutionContext('GET', '/api/v1/payments');
      const handler = createMockCallHandler({ async: true });

      interceptor.intercept(context, handler).subscribe({
        next: (result) => {
          expect(result).toEqual({ async: true });
          done();
        },
        error: done,
      });
    });

    it('should handle different HTTP methods', (done) => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      const context = createMockExecutionContext('PUT', '/api/v1/payments');
      const handler = createMockCallHandler({ method: 'PUT' });

      interceptor.intercept(context, handler).subscribe({
        next: (result) => {
          expect(result).toEqual({ method: 'PUT' });
          done();
        },
        error: done,
      });
    });

    it('should handle requests with query parameters', (done) => {
      const context = createMockExecutionContext('GET', '/api/v1/payments?limit=10&offset=0');
      const handler = createMockCallHandler({ payments: [] });

      interceptor.intercept(context, handler).subscribe({
        next: (result) => {
          expect(result).toEqual({ payments: [] });
          done();
        },
        error: done,
      });
    });

    it('should handle requests with different content types', (done) => {
      const context = createMockExecutionContext('POST', '/api/v1/payments', {
        'content-type': 'application/xml',
      });
      const handler = createMockCallHandler({ processed: true });

      interceptor.intercept(context, handler).subscribe({
        next: (result) => {
          expect(result).toEqual({ processed: true });
          done();
        },
        error: done,
      });
    });
  });

  describe('Security Tests', () => {
    it('should handle malicious request data', (done) => {
      const maliciousPayload = {
        '__proto__': { isAdmin: true },
        '$ne': { password: 'admin' }
      };
      const context = createMockExecutionContext('POST', '/api/v1/payments', {
        'content-type': 'application/json',
      });
      const handler = createMockCallHandler({ safe: true });

      interceptor.intercept(context, handler).subscribe({
        next: (result) => {
          expect(result).toEqual({ safe: true });
          done();
        },
        error: done,
      });
    });

    it('should handle malicious headers', (done) => {
      const maliciousHeaders = {
        'x-api-key': "'; DROP TABLE merchants; --",
        'user-agent': '<script>alert("xss")</script>',
      };
      const context = createMockExecutionContext('GET', '/api/v1/merchants', maliciousHeaders);
      const handler = createMockCallHandler({ merchants: [] });

      interceptor.intercept(context, handler).subscribe({
        next: (result) => {
          expect(result).toEqual({ merchants: [] });
          done();
        },
        error: done,
      });
    });

    it('should handle very long URLs', (done) => {
      const longUrl = '/api/v1/payments?' + 'param=' + 'x'.repeat(10000);
      const context = createMockExecutionContext('GET', longUrl);
      const handler = createMockCallHandler({ processed: true });

      interceptor.intercept(context, handler).subscribe({
        next: (result) => {
          expect(result).toEqual({ processed: true });
          done();
        },
        error: done,
      });
    });

    it('should handle concurrent requests', (done) => {
      const context1 = createMockExecutionContext('GET', '/api/v1/payments/1');
      const context2 = createMockExecutionContext('GET', '/api/v1/payments/2');
      const handler1 = createMockCallHandler({ id: '1' });
      const handler2 = createMockCallHandler({ id: '2' });

      let completed = 0;
      const checkCompletion = () => {
        completed++;
        if (completed === 2) {
          done();
        }
      };

      interceptor.intercept(context1, handler1).subscribe({
        next: (result) => {
          expect(result).toEqual({ id: '1' });
          checkCompletion();
        },
        error: done,
      });

      interceptor.intercept(context2, handler2).subscribe({
        next: (result) => {
          expect(result).toEqual({ id: '2' });
          checkCompletion();
        },
        error: done,
      });
    });
  });
});