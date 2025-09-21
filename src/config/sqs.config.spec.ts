import { sqsConfig } from './sqs.config';

describe('sqsConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return default configuration when no environment variables are set', () => {
    delete process.env.AWS_REGION;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.SQS_QUEUE_URL;
    delete process.env.SQS_ENDPOINT;

    const config = sqsConfig();

    expect(config).toEqual({
      region: 'us-east-1',
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key',
      queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/payment-events',
      endpoint: undefined,
    });
  });

  it('should use environment variables when provided', () => {
    process.env.AWS_REGION = 'eu-west-1';
    process.env.AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
    process.env.AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
    process.env.SQS_QUEUE_URL = 'https://sqs.eu-west-1.amazonaws.com/123456789012/payment-events';
    process.env.SQS_ENDPOINT = 'https://sqs.eu-west-1.amazonaws.com';

    const config = sqsConfig();

    expect(config).toEqual({
      region: 'eu-west-1',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      queueUrl: 'https://sqs.eu-west-1.amazonaws.com/123456789012/payment-events',
      endpoint: 'https://sqs.eu-west-1.amazonaws.com',
    });
  });

  it('should handle partial environment variables', () => {
    process.env.AWS_REGION = 'us-west-2';
    process.env.AWS_ACCESS_KEY_ID = 'AKIAEXAMPLE123';
    // Other variables not set

    const config = sqsConfig();

    expect(config).toEqual({
      region: 'us-west-2',
      accessKeyId: 'AKIAEXAMPLE123',
      secretAccessKey: 'test-secret-key',
      queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/payment-events',
      endpoint: undefined,
    });
  });

  it('should handle LocalStack configuration', () => {
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ACCESS_KEY_ID = 'test';
    process.env.AWS_SECRET_ACCESS_KEY = 'test';
    process.env.SQS_QUEUE_URL = 'http://localhost:4566/000000000000/payment-events';
    process.env.SQS_ENDPOINT = 'http://localhost:4566';

    const config = sqsConfig();

    expect(config).toEqual({
      region: 'us-east-1',
      accessKeyId: 'test',
      secretAccessKey: 'test',
      queueUrl: 'http://localhost:4566/000000000000/payment-events',
      endpoint: 'http://localhost:4566',
    });
  });

  it('should handle production AWS configuration', () => {
    process.env.AWS_REGION = 'ap-southeast-1';
    process.env.AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7PRODEXAMPLE';
    process.env.AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYPRODEXAMPLEKEY';
    process.env.SQS_QUEUE_URL = 'https://sqs.ap-southeast-1.amazonaws.com/987654321098/payment-events-prod';
    process.env.SQS_ENDPOINT = 'https://sqs.ap-southeast-1.amazonaws.com';

    const config = sqsConfig();

    expect(config).toEqual({
      region: 'ap-southeast-1',
      accessKeyId: 'AKIAIOSFODNN7PRODEXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYPRODEXAMPLEKEY',
      queueUrl: 'https://sqs.ap-southeast-1.amazonaws.com/987654321098/payment-events-prod',
      endpoint: 'https://sqs.ap-southeast-1.amazonaws.com',
    });
  });

  it('should handle empty string values', () => {
    process.env.AWS_ACCESS_KEY_ID = '';
    process.env.AWS_SECRET_ACCESS_KEY = '';
    process.env.SQS_QUEUE_URL = '';
    process.env.SQS_ENDPOINT = '';

    const config = sqsConfig();

    expect(config).toEqual({
      region: 'us-east-1',
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key',
      queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/payment-events',
      endpoint: undefined,
    });
  });

  it('should handle different AWS regions', () => {
    const regions = [
      'us-east-1',
      'us-west-1',
      'us-west-2',
      'eu-west-1',
      'eu-central-1',
      'ap-southeast-1',
      'ap-northeast-1',
    ];

    regions.forEach((region) => {
      process.env.AWS_REGION = region;
      const config = sqsConfig();
      expect(config.region).toBe(region);
    });
  });

  it('should handle queue URLs with different formats', () => {
    const queueUrls = [
      'https://sqs.us-east-1.amazonaws.com/123456789012/payment-events',
      'https://sqs.us-east-1.amazonaws.com/123456789012/payment-events.fifo',
      'http://localhost:9324/queue/payment-events',
      'http://localhost:4566/000000000000/payment-events',
    ];

    queueUrls.forEach((queueUrl) => {
      process.env.SQS_QUEUE_URL = queueUrl;
      const config = sqsConfig();
      expect(config.queueUrl).toBe(queueUrl);
    });
  });

  it('should handle endpoint URLs with different formats', () => {
    const endpoints = [
      'https://sqs.us-east-1.amazonaws.com',
      'http://localhost:9324',
      'http://localhost:4566',
      'https://sqs.eu-west-1.amazonaws.com',
    ];

    endpoints.forEach((endpoint) => {
      process.env.SQS_ENDPOINT = endpoint;
      const config = sqsConfig();
      expect(config.endpoint).toBe(endpoint);
    });
  });

  it('should handle long access keys', () => {
    const longAccessKey = 'AKIA' + 'A'.repeat(16);
    process.env.AWS_ACCESS_KEY_ID = longAccessKey;

    const config = sqsConfig();

    expect(config.accessKeyId).toBe(longAccessKey);
  });

  it('should handle long secret keys', () => {
    const longSecretKey = 'B'.repeat(40);
    process.env.AWS_SECRET_ACCESS_KEY = longSecretKey;

    const config = sqsConfig();

    expect(config.secretAccessKey).toBe(longSecretKey);
  });

  it('should handle special characters in credentials', () => {
    process.env.AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
    process.env.AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';

    const config = sqsConfig();

    expect(config.accessKeyId).toBe('AKIAIOSFODNN7EXAMPLE');
    expect(config.secretAccessKey).toBe('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
  });
});
