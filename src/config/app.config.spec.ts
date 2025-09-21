import { appConfig } from './app.config';

describe('appConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return default configuration when no environment variables are set', () => {
    delete process.env.NODE_ENV;
    delete process.env.PORT;
    delete process.env.API_PREFIX;
    delete process.env.RATE_LIMIT_TTL;
    delete process.env.RATE_LIMIT_MAX;
    delete process.env.ALLOWED_ORIGINS;

    const config = appConfig();

    expect(config).toEqual({
      nodeEnv: 'development',
      port: 3000,
      apiPrefix: 'api/v1',
      rateLimitTtl: 60,
      rateLimitMax: 100,
      allowedOrigins: ['http://localhost:3000'],
    });
  });

  it('should use environment variables when provided', () => {
    process.env.NODE_ENV = 'production';
    process.env.PORT = '8080';
    process.env.API_PREFIX = 'api/v2';
    process.env.RATE_LIMIT_TTL = '120';
    process.env.RATE_LIMIT_MAX = '200';
    process.env.ALLOWED_ORIGINS = 'https://example.com,https://api.example.com';

    const config = appConfig();

    expect(config).toEqual({
      nodeEnv: 'production',
      port: 8080,
      apiPrefix: 'api/v2',
      rateLimitTtl: 120,
      rateLimitMax: 200,
      allowedOrigins: ['https://example.com', 'https://api.example.com'],
    });
  });

  it('should handle partial environment variables', () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '4000';
    // Other variables not set

    const config = appConfig();

    expect(config).toEqual({
      nodeEnv: 'test',
      port: 4000,
      apiPrefix: 'api/v1',
      rateLimitTtl: 60,
      rateLimitMax: 100,
      allowedOrigins: ['http://localhost:3000'],
    });
  });

  it('should handle empty ALLOWED_ORIGINS', () => {
    process.env.ALLOWED_ORIGINS = '';

    const config = appConfig();

    expect(config.allowedOrigins).toEqual(['']);
  });

  it('should handle single allowed origin', () => {
    process.env.ALLOWED_ORIGINS = 'https://single-origin.com';

    const config = appConfig();

    expect(config.allowedOrigins).toEqual(['https://single-origin.com']);
  });

  it('should handle multiple allowed origins with spaces', () => {
    process.env.ALLOWED_ORIGINS = 'https://origin1.com, https://origin2.com , https://origin3.com';

    const config = appConfig();

    expect(config.allowedOrigins).toEqual([
      'https://origin1.com',
      ' https://origin2.com ',
      ' https://origin3.com',
    ]);
  });

  it('should handle invalid PORT values gracefully', () => {
    process.env.PORT = 'invalid';

    const config = appConfig();

    expect(config.port).toBe(3000); // Should fall back to default
  });

  it('should handle invalid RATE_LIMIT_TTL values gracefully', () => {
    process.env.RATE_LIMIT_TTL = 'invalid';

    const config = appConfig();

    expect(config.rateLimitTtl).toBe(60); // Should fall back to default
  });

  it('should handle invalid RATE_LIMIT_MAX values gracefully', () => {
    process.env.RATE_LIMIT_MAX = 'invalid';

    const config = appConfig();

    expect(config.rateLimitMax).toBe(100); // Should fall back to default
  });

  it('should handle zero values for rate limiting', () => {
    process.env.RATE_LIMIT_TTL = '0';
    process.env.RATE_LIMIT_MAX = '0';

    const config = appConfig();

    expect(config.rateLimitTtl).toBe(0);
    expect(config.rateLimitMax).toBe(0);
  });

  it('should handle negative values for rate limiting', () => {
    process.env.RATE_LIMIT_TTL = '-1';
    process.env.RATE_LIMIT_MAX = '-5';

    const config = appConfig();

    expect(config.rateLimitTtl).toBe(-1);
    expect(config.rateLimitMax).toBe(-5);
  });

  it('should handle very large values', () => {
    process.env.PORT = '99999';
    process.env.RATE_LIMIT_TTL = '999999';
    process.env.RATE_LIMIT_MAX = '999999';

    const config = appConfig();

    expect(config.port).toBe(99999);
    expect(config.rateLimitTtl).toBe(999999);
    expect(config.rateLimitMax).toBe(999999);
  });
});
