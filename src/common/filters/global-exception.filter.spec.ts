import { Test, TestingModule } from '@nestjs/testing';
import { ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { GlobalExceptionFilter } from './global-exception.filter';

// Mock functions for testing
const createMockResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

const createMockArgumentsHost = (request: any, response: any) => ({
  switchToHttp: () => ({
    getResponse: () => response,
    getRequest: () => request,
  }),
  getArgs: () => [],
  getArgByIndex: (index: number) => undefined,
  switchToRpc: () => ({ getContext: () => ({}) }),
  switchToWs: () => ({ getClient: () => ({}), getData: () => ({}) }),
  getType: () => 'http',
} as unknown as ArgumentsHost);

// Mock Logger
const mockLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  log: jest.fn(),
};

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GlobalExceptionFilter],
    }).compile();

    filter = module.get<GlobalExceptionFilter>(GlobalExceptionFilter);
    // Replace the logger with our mock
    (filter as any).logger = mockLogger;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('catch', () => {
    it('should handle HttpException with proper status and message', () => {
      const exception = new HttpException('Test error message', HttpStatus.BAD_REQUEST);
      const mockResponse = createMockResponse();
      const host = createMockArgumentsHost({}, mockResponse);

      filter.catch(exception, host);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Test error message',
        timestamp: expect.any(String),
        path: undefined,
        method: undefined,
        correlationId: undefined,
      });
    });

    it('should handle HttpException with custom error object', () => {
      const customError = { message: 'Custom error', code: 'CUSTOM_ERROR' };
      const exception = new HttpException(customError, HttpStatus.UNPROCESSABLE_ENTITY);
      const mockResponse = createMockResponse();
      const host = createMockArgumentsHost({}, mockResponse);

      filter.catch(exception, host);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        message: 'Custom error',
        details: customError,
        timestamp: expect.any(String),
        path: undefined,
        method: undefined,
        correlationId: undefined,
      });
    });

    it('should handle generic Error with 500 status', () => {
      const exception = new Error('Generic error');
      const mockResponse = createMockResponse();
      const host = createMockArgumentsHost({}, mockResponse);

      filter.catch(exception, host);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        timestamp: expect.any(String),
        path: undefined,
        method: undefined,
        correlationId: undefined,
      });
    });

    it('should handle NotFoundException', () => {
      const exception = new HttpException('Resource not found', HttpStatus.NOT_FOUND);
      const mockResponse = createMockResponse();
      const host = createMockArgumentsHost({}, mockResponse);

      filter.catch(exception, host);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Resource not found',
        timestamp: expect.any(String),
        path: undefined,
        method: undefined,
        correlationId: undefined,
      });
    });

    it('should handle UnauthorizedException', () => {
      const exception = new HttpException('Unauthorized access', HttpStatus.UNAUTHORIZED);
      const mockResponse = createMockResponse();
      const host = createMockArgumentsHost({}, mockResponse);

      filter.catch(exception, host);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Unauthorized access',
        timestamp: expect.any(String),
        path: undefined,
        method: undefined,
        correlationId: undefined,
      });
    });

    it('should handle ForbiddenException', () => {
      const exception = new HttpException('Access forbidden', HttpStatus.FORBIDDEN);
      const mockResponse = createMockResponse();
      const host = createMockArgumentsHost({}, mockResponse);

      filter.catch(exception, host);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.FORBIDDEN,
        message: 'Access forbidden',
        timestamp: expect.any(String),
        path: undefined,
        method: undefined,
        correlationId: undefined,
      });
    });

    it('should handle ConflictException', () => {
      const exception = new HttpException('Resource conflict', HttpStatus.CONFLICT);
      const mockResponse = createMockResponse();
      const host = createMockArgumentsHost({}, mockResponse);

      filter.catch(exception, host);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.CONFLICT,
        message: 'Resource conflict',
        timestamp: expect.any(String),
        path: undefined,
        method: undefined,
        correlationId: undefined,
      });
    });

    it('should handle ValidationException', () => {
      const exception = new HttpException('Validation failed', HttpStatus.BAD_REQUEST);
      const mockResponse = createMockResponse();
      const host = createMockArgumentsHost({}, mockResponse);

      filter.catch(exception, host);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Validation failed',
        timestamp: expect.any(String),
        path: undefined,
        method: undefined,
        correlationId: undefined,
      });
    });

    it('should include request path in error response', () => {
      const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);
      const mockResponse = createMockResponse();
      const host = createMockArgumentsHost({ url: '/api/v1/payments' }, mockResponse);

      filter.catch(exception, host);

      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Test error',
        timestamp: expect.any(String),
        path: '/api/v1/payments',
        method: undefined,
        correlationId: undefined,
      });
    });

    it('should handle errors without message', () => {
      const exception = new HttpException('', HttpStatus.BAD_REQUEST);
      const mockResponse = createMockResponse();
      const host = createMockArgumentsHost({}, mockResponse);

      filter.catch(exception, host);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.BAD_REQUEST,
        message: '',
        timestamp: expect.any(String),
        path: undefined,
        method: undefined,
        correlationId: undefined,
      });
    });

    it('should handle errors with null message', () => {
      const exception = new HttpException('', HttpStatus.BAD_REQUEST);
      const mockResponse = createMockResponse();
      const host = createMockArgumentsHost({}, mockResponse);

      filter.catch(exception, host);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.BAD_REQUEST,
        message: '',
        timestamp: expect.any(String),
        path: undefined,
        method: undefined,
        correlationId: undefined,
      });
    });

    it('should handle errors with undefined message', () => {
      const exception = new HttpException('', HttpStatus.BAD_REQUEST);
      const mockResponse = createMockResponse();
      const host = createMockArgumentsHost({}, mockResponse);

      filter.catch(exception, host);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.BAD_REQUEST,
        message: '',
        timestamp: expect.any(String),
        path: undefined,
        method: undefined,
        correlationId: undefined,
      });
    });

    it('should log errors appropriately', () => {
      const exception = new Error('Test error');
      const mockResponse = createMockResponse();
      const host = createMockArgumentsHost({}, mockResponse);

      filter.catch(exception, host);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('HTTP 500 Error'),
        expect.any(String),
      );
    });

    it('should handle database connection errors', () => {
      const exception = new Error('Connection refused');
      const mockResponse = createMockResponse();
      const host = createMockArgumentsHost({}, mockResponse);

      filter.catch(exception, host);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        timestamp: expect.any(String),
        path: undefined,
        method: undefined,
        correlationId: undefined,
      });
    });

    it('should handle network errors', () => {
      const exception = new Error('Network timeout');
      const mockResponse = createMockResponse();
      const host = createMockArgumentsHost({}, mockResponse);

      filter.catch(exception, host);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        timestamp: expect.any(String),
        path: undefined,
        method: undefined,
        correlationId: undefined,
      });
    });
  });

  describe('Security Tests', () => {
    it('should not expose sensitive information in error messages', () => {
      const exception = new Error('Database password: secret123');
      const mockResponse = createMockResponse();
      const host = createMockArgumentsHost({}, mockResponse);

      filter.catch(exception, host);

      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        timestamp: expect.any(String),
        path: undefined,
        method: undefined,
        correlationId: undefined,
      });
    });

    it('should handle malicious error messages', () => {
      const exception = new Error('<script>alert("xss")</script>');
      const mockResponse = createMockResponse();
      const host = createMockArgumentsHost({}, mockResponse);

      filter.catch(exception, host);

      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        timestamp: expect.any(String),
        path: undefined,
        method: undefined,
        correlationId: undefined,
      });
    });

    it('should handle SQL injection attempts in error messages', () => {
      const exception = new Error("'; DROP TABLE users; --");
      const mockResponse = createMockResponse();
      const host = createMockArgumentsHost({}, mockResponse);

      filter.catch(exception, host);

      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        timestamp: expect.any(String),
        path: undefined,
        method: undefined,
        correlationId: undefined,
      });
    });

    it('should handle very long error messages', () => {
      const longMessage = 'x'.repeat(10000);
      const exception = new Error(longMessage);
      const mockResponse = createMockResponse();
      const host = createMockArgumentsHost({}, mockResponse);

      filter.catch(exception, host);

      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        timestamp: expect.any(String),
        path: undefined,
        method: undefined,
        correlationId: undefined,
      });
    });
  });
});