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
    const createMockArgumentsHost = (request: any = {}, response: any = {}) => {
      return {
        switchToHttp: () => ({
          getRequest: () => request,
          getResponse: () => response,
        }),
      } as ArgumentsHost;
    };

    const createMockResponse = () => {
      return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response;
    };

    it('should handle HttpException with proper status and message', () => {
      const exception = new HttpException('Test error message', HttpStatus.BAD_REQUEST);
      const mockResponse = createMockResponse();
      const host = createMockArgumentsHost({}, mockResponse);

      filter.catch(exception, host);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Test error message',
        error: 'Bad Request',
        timestamp: expect.any(String),
        path: undefined,
      });
    });

    it('should handle HttpException with custom error object', () => {
      const exception = new HttpException(
        { message: 'Custom error', code: 'CUSTOM_ERROR' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
      const mockResponse = createMockResponse();
      const host = createMockArgumentsHost({}, mockResponse);

      filter.catch(exception, host);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        message: { message: 'Custom error', code: 'CUSTOM_ERROR' },
        error: 'Unprocessable Entity',
        timestamp: expect.any(String),
        path: undefined,
      });
    });

    it('should handle generic Error with 500 status', () => {
      const exception = new Error('Generic error message');
      const mockResponse = createMockResponse();
      const host = createMockArgumentsHost({}, mockResponse);

      filter.catch(exception, host);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        error: 'Internal Server Error',
        timestamp: expect.any(String),
        path: undefined,
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
        error: 'Not Found',
        timestamp: expect.any(String),
        path: undefined,
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
        error: 'Unauthorized',
        timestamp: expect.any(String),
        path: undefined,
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
        error: 'Forbidden',
        timestamp: expect.any(String),
        path: undefined,
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
        error: 'Conflict',
        timestamp: expect.any(String),
        path: undefined,
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
        error: 'Bad Request',
        timestamp: expect.any(String),
        path: undefined,
      });
    });

    it('should include request path in error response', () => {
      const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);
      const mockResponse = createMockResponse();
      const host = createMockArgumentsHost(
        { url: '/api/v1/payments' },
        mockResponse,
      );

      filter.catch(exception, host);

      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Test error',
        error: 'Bad Request',
        timestamp: expect.any(String),
        path: '/api/v1/payments',
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
        error: 'Bad Request',
        timestamp: expect.any(String),
        path: undefined,
      });
    });

    it('should handle errors with null message', () => {
      const exception = new HttpException('Bad request', HttpStatus.BAD_REQUEST);
      const mockResponse = createMockResponse();
      const host = createMockArgumentsHost({}, mockResponse);

      filter.catch(exception, host);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.BAD_REQUEST,
        message: null,
        error: 'Bad Request',
        timestamp: expect.any(String),
        path: undefined,
      });
    });

    it('should handle errors with undefined message', () => {
      const exception = new HttpException('Bad request', HttpStatus.BAD_REQUEST);
      const mockResponse = createMockResponse();
      const host = createMockArgumentsHost({}, mockResponse);

      filter.catch(exception, host);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.BAD_REQUEST,
        message: undefined,
        error: 'Bad Request',
        timestamp: expect.any(String),
        path: undefined,
      });
    });

    it('should log errors appropriately', () => {
      const exception = new Error('Test error');
      const mockResponse = createMockResponse();
      const host = createMockArgumentsHost({}, mockResponse);

      filter.catch(exception, host);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Test error'),
        expect.any(String),
      );
    });

    it('should handle database connection errors', () => {
      const exception = new Error('Connection timeout');
      const mockResponse = createMockResponse();
      const host = createMockArgumentsHost({}, mockResponse);

      filter.catch(exception, host);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        error: 'Internal Server Error',
        timestamp: expect.any(String),
        path: undefined,
      });
    });

    it('should handle network errors', () => {
      const exception = new Error('Network error');
      const mockResponse = createMockResponse();
      const host = createMockArgumentsHost({}, mockResponse);

      filter.catch(exception, host);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        error: 'Internal Server Error',
        timestamp: expect.any(String),
        path: undefined,
      });
    });
  });

  describe('Security Tests', () => {
    it('should not expose sensitive information in error messages', () => {
      const exception = new Error('Database connection failed: user=admin, password=secret123');
      const mockResponse = createMockResponse();
      const host = createMockArgumentsHost({}, mockResponse);

      filter.catch(exception, host);

      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        error: 'Internal Server Error',
        timestamp: expect.any(String),
        path: undefined,
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
        error: 'Internal Server Error',
        timestamp: expect.any(String),
        path: undefined,
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
        error: 'Internal Server Error',
        timestamp: expect.any(String),
        path: undefined,
      });
    });

    it('should handle very long error messages', () => {
      const longMessage = 'a'.repeat(100000);
      const exception = new Error(longMessage);
      const mockResponse = createMockResponse();
      const host = createMockArgumentsHost({}, mockResponse);

      filter.catch(exception, host);

      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        error: 'Internal Server Error',
        timestamp: expect.any(String),
        path: undefined,
      });
    });
  });
});
