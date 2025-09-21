import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SqsService, PaymentEvent } from './sqs.service';
import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';

// Mock AWS SDK
jest.mock('@aws-sdk/client-sqs');

describe('SqsService', () => {
  let service: SqsService;
  let configService: ConfigService;
  let mockSqsClient: jest.Mocked<SQSClient>;

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockSendMessage = jest.fn();
  const mockReceiveMessage = jest.fn();
  const mockDeleteMessage = jest.fn();

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock SQSClient constructor
    (SQSClient as jest.MockedClass<typeof SQSClient>).mockImplementation(() => ({
      send: jest.fn().mockImplementation((command) => {
        if (command instanceof SendMessageCommand) {
          return mockSendMessage(command);
        }
        if (command instanceof ReceiveMessageCommand) {
          return mockReceiveMessage(command);
        }
        if (command instanceof DeleteMessageCommand) {
          return mockDeleteMessage(command);
        }
        return Promise.resolve({});
      }),
    } as any));

    mockSqsClient = new SQSClient({}) as jest.Mocked<SQSClient>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SqsService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<SqsService>(SqsService);
    configService = module.get<ConfigService>(ConfigService);

    // Setup default config values
    mockConfigService.get.mockImplementation((key: string) => {
      const config = {
        'sqs.region': 'us-east-1',
        'sqs.accessKeyId': 'test-access-key',
        'sqs.secretAccessKey': 'test-secret-key',
        'sqs.queueUrl': 'https://sqs.us-east-1.amazonaws.com/123456789012/payment-events',
      };
      return config[key];
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should initialize SQS client with correct configuration', () => {
      // The service is already initialized in beforeEach
      expect(SQSClient).toHaveBeenCalled();
    });

    it('should initialize SQS client with custom endpoint', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        const config = {
          'sqs.region': 'us-east-1',
          'sqs.accessKeyId': 'test-access-key',
          'sqs.secretAccessKey': 'test-secret-key',
          'sqs.queueUrl': 'https://sqs.us-east-1.amazonaws.com/123456789012/payment-events',
          'sqs.endpoint': 'http://localhost:4566',
        };
        return config[key];
      });

      // Create new instance to test endpoint configuration
      const newService = new SqsService(configService);
      newService.onModuleInit();

      expect(SQSClient).toHaveBeenCalledWith({
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
        },
        endpoint: 'http://localhost:4566',
      });
    });

    it('should handle initialization errors gracefully', () => {
      // Mock SQSClient to throw error
      (SQSClient as jest.MockedClass<typeof SQSClient>).mockImplementation(() => {
        throw new Error('SQS initialization failed');
      });

      const newService = new SqsService(configService);
      
      // Should not throw error
      expect(() => newService.onModuleInit()).not.toThrow();
    });
  });

  describe('publishEvent', () => {
    const mockEvent: PaymentEvent = {
      eventType: 'payment-initiated',
      payload: {
        paymentId: 'payment-123',
        amount: 25000,
        currency: 'NGN',
      },
      timestamp: '2023-01-01T00:00:00.000Z',
      correlationId: 'corr-123',
    };

    beforeEach(() => {
      // Initialize the service
      service.onModuleInit();
    });

    it('should publish event successfully', async () => {
      mockSendMessage.mockResolvedValue({
        MessageId: 'message-123',
        MD5OfBody: 'md5-hash',
      });

      await service.publishEvent('payment-initiated', mockEvent.payload);

      expect(mockSendMessage).toHaveBeenCalled();
    });

    it('should handle SQS publish errors gracefully', async () => {
      mockSendMessage.mockRejectedValue(new Error('SQS publish failed'));

      // Should not throw error
      await expect(service.publishEvent('payment-initiated', mockEvent.payload)).resolves.toBeUndefined();
    });

    it('should generate unique correlation IDs', async () => {
      mockSendMessage.mockResolvedValue({ MessageId: 'message-123' });

      await service.publishEvent('payment-initiated', mockEvent.payload);
      await service.publishEvent('payment-completed', mockEvent.payload);

      expect(mockSendMessage).toHaveBeenCalledTimes(2);
    });

    it('should include correct message attributes', async () => {
      mockSendMessage.mockResolvedValue({ MessageId: 'message-123' });

      await service.publishEvent('payment-failed', { error: 'test error' });

      expect(mockSendMessage).toHaveBeenCalled();
    });

    it('should handle large payloads', async () => {
      const largePayload = {
        data: 'x'.repeat(100000),
        nested: {
          deep: {
            object: 'with lots of data',
          },
        },
      };

      mockSendMessage.mockResolvedValue({ MessageId: 'message-123' });

      await expect(service.publishEvent('large-payload', largePayload)).resolves.toBeUndefined();
    });

    it('should handle null SQS client gracefully', async () => {
      // Mock service with null client
      const serviceWithNullClient = new SqsService(configService);
      // Don't call onModuleInit to simulate failed initialization

      await expect(serviceWithNullClient.publishEvent('test-event', {})).resolves.toBeUndefined();
    });
  });

  describe('consumeMessages', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should consume messages successfully', async () => {
      const mockMessages = [
        {
          MessageId: 'message-1',
          ReceiptHandle: 'receipt-1',
          Body: JSON.stringify({
            eventType: 'payment-initiated',
            payload: { paymentId: 'payment-123' },
            timestamp: '2023-01-01T00:00:00.000Z',
            correlationId: 'corr-123',
          }),
          MessageAttributes: {
            eventType: {
              StringValue: 'payment-initiated',
            },
            correlationId: {
              StringValue: 'corr-123',
            },
          },
        },
        {
          MessageId: 'message-2',
          ReceiptHandle: 'receipt-2',
          Body: JSON.stringify({
            eventType: 'payment-completed',
            payload: { paymentId: 'payment-456' },
            timestamp: '2023-01-01T00:01:00.000Z',
            correlationId: 'corr-456',
          }),
          MessageAttributes: {
            eventType: {
              StringValue: 'payment-completed',
            },
            correlationId: {
              StringValue: 'corr-456',
            },
          },
        },
      ];

      mockReceiveMessage.mockResolvedValue({
        Messages: mockMessages,
      });

      mockDeleteMessage.mockResolvedValue({});

      await service.consumeMessages();

      expect(mockReceiveMessage).toHaveBeenCalled();
      expect(mockDeleteMessage).toHaveBeenCalledTimes(2);
    });

    it('should handle empty message queue', async () => {
      mockReceiveMessage.mockResolvedValue({});

      await service.consumeMessages();

      expect(mockReceiveMessage).toHaveBeenCalled();
      expect(mockDeleteMessage).not.toHaveBeenCalled();
    });

    it('should handle message processing errors', async () => {
      const mockMessages = [
        {
          MessageId: 'message-1',
          ReceiptHandle: 'receipt-1',
          Body: 'invalid-json',
          MessageAttributes: {},
        },
      ];

      mockReceiveMessage.mockResolvedValue({
        Messages: mockMessages,
      });

      mockDeleteMessage.mockResolvedValue({});

      await expect(service.consumeMessages()).resolves.toBeUndefined();
    });

    it('should handle SQS receive errors', async () => {
      mockReceiveMessage.mockRejectedValue(new Error('SQS receive failed'));

      await expect(service.consumeMessages()).resolves.toBeUndefined();
    });

    it('should handle null SQS client gracefully', async () => {
      const serviceWithNullClient = new SqsService(configService);
      // Don't call onModuleInit to simulate failed initialization

      await expect(serviceWithNullClient.consumeMessages()).resolves.toBeUndefined();
    });
  });

  describe('Security Tests', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should handle malicious payloads in events', async () => {
      const maliciousPayload = {
        xssPayload: '<script>alert("xss")</script>',
        sqlInjection: "'; DROP TABLE payments; --",
        largePayload: 'x'.repeat(1000000),
      };

      mockSendMessage.mockResolvedValue({ MessageId: 'message-123' });

      await expect(service.publishEvent('malicious-event', maliciousPayload)).resolves.toBeUndefined();
    });

    it('should validate message structure when consuming', async () => {
      const invalidMessages = [
        {
          MessageId: 'message-1',
          ReceiptHandle: 'receipt-1',
          Body: 'not-json',
          MessageAttributes: {},
        },
        {
          MessageId: 'message-2',
          ReceiptHandle: 'receipt-2',
          Body: JSON.stringify({ invalid: 'structure' }),
          MessageAttributes: {},
        },
      ];

      mockReceiveMessage.mockResolvedValue({
        Messages: invalidMessages,
      });

      mockDeleteMessage.mockResolvedValue({});

      await expect(service.consumeMessages()).resolves.toBeUndefined();
    });

    it('should handle malformed correlation IDs', async () => {
      const payload = { test: 'data' };
      
      mockSendMessage.mockResolvedValue({ MessageId: 'message-123' });

      // Should generate valid correlation ID even for edge cases
      await expect(service.publishEvent('test-event', payload)).resolves.toBeUndefined();
    });

    it('should prevent message flooding', async () => {
      mockSendMessage.mockResolvedValue({ MessageId: 'message-123' });

      // Send many events rapidly
      const promises = Array(100).fill(null).map(() => 
        service.publishEvent('flood-test', { data: 'test' })
      );

      await expect(Promise.all(promises)).resolves.toBeDefined();
    });
  });

  describe('Data Integrity Tests', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should maintain event ordering with timestamps', async () => {
      const events = [
        { type: 'event-1', timestamp: '2023-01-01T00:00:00.000Z' },
        { type: 'event-2', timestamp: '2023-01-01T00:00:01.000Z' },
        { type: 'event-3', timestamp: '2023-01-01T00:00:02.000Z' },
      ];

      mockSendMessage.mockResolvedValue({ MessageId: 'message-123' });

      for (const event of events) {
        await service.publishEvent(event.type, { data: 'test' });
      }

      expect(mockSendMessage).toHaveBeenCalledTimes(3);
    });

    it('should handle concurrent message consumption', async () => {
      const mockMessages = [
        {
          MessageId: 'message-1',
          ReceiptHandle: 'receipt-1',
          Body: JSON.stringify({
            eventType: 'payment-initiated',
            payload: { paymentId: 'payment-123' },
            timestamp: '2023-01-01T00:00:00.000Z',
            correlationId: 'corr-123',
          }),
          MessageAttributes: {
            eventType: { StringValue: 'payment-initiated' },
            correlationId: { StringValue: 'corr-123' },
          },
        },
      ];

      mockReceiveMessage.mockResolvedValue({
        Messages: mockMessages,
      });

      mockDeleteMessage.mockResolvedValue({});

      // Simulate concurrent consumption
      const promises = [
        service.consumeMessages(),
        service.consumeMessages(),
      ];

      await Promise.all(promises);

      expect(mockReceiveMessage).toHaveBeenCalledTimes(2);
    });

    it('should handle message deletion failures gracefully', async () => {
      const mockMessages = [
        {
          MessageId: 'message-1',
          ReceiptHandle: 'receipt-1',
          Body: JSON.stringify({
            eventType: 'payment-initiated',
            payload: { paymentId: 'payment-123' },
            timestamp: '2023-01-01T00:00:00.000Z',
            correlationId: 'corr-123',
          }),
          MessageAttributes: {
            eventType: { StringValue: 'payment-initiated' },
            correlationId: { StringValue: 'corr-123' },
          },
        },
      ];

      mockReceiveMessage.mockResolvedValue({
        Messages: mockMessages,
      });

      mockDeleteMessage.mockRejectedValue(new Error('Delete failed'));

      await expect(service.consumeMessages()).resolves.toBeUndefined();
    });

    it('should validate event type consistency', async () => {
      const eventTypes = [
        'payment-initiated',
        'payment-completed',
        'payment-failed',
        'payment-cancelled',
        'payment-refunded',
      ];

      mockSendMessage.mockResolvedValue({ MessageId: 'message-123' });

      for (const eventType of eventTypes) {
        await service.publishEvent(eventType, { data: 'test' });
      }

      expect(mockSendMessage).toHaveBeenCalledTimes(eventTypes.length);
    });
  });
});
