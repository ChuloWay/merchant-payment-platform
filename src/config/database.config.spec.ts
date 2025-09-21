import { databaseConfig } from './database.config';

describe('databaseConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return default configuration when no environment variables are set', () => {
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_USERNAME;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_NAME;
    delete process.env.DB_SSL;

    const config = databaseConfig();

    expect(config).toEqual({
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'password',
      name: 'payment_system',
      ssl: false,
    });
  });

  it('should use environment variables when provided', () => {
    process.env.DB_HOST = 'prod-db.example.com';
    process.env.DB_PORT = '5433';
    process.env.DB_USERNAME = 'prod_user';
    process.env.DB_PASSWORD = 'secure_password';
    process.env.DB_NAME = 'prod_payment_system';
    process.env.DB_SSL = 'true';

    const config = databaseConfig();

    expect(config).toEqual({
      host: 'prod-db.example.com',
      port: 5433,
      username: 'prod_user',
      password: 'secure_password',
      name: 'prod_payment_system',
      ssl: { rejectUnauthorized: false },
    });
  });

  it('should handle partial environment variables', () => {
    process.env.DB_HOST = 'custom-host';
    process.env.DB_PORT = '3306';
    // Other variables not set

    const config = databaseConfig();

    expect(config).toEqual({
      host: 'custom-host',
      port: 3306,
      username: 'postgres',
      password: 'password',
      name: 'payment_system',
      ssl: false,
    });
  });

  it('should handle SSL configuration as string "true"', () => {
    process.env.DB_SSL = 'true';

    const config = databaseConfig();

    expect(config.ssl).toEqual({ rejectUnauthorized: false });
  });

  it('should handle SSL configuration as string "false"', () => {
    process.env.DB_SSL = 'false';

    const config = databaseConfig();

    expect(config.ssl).toBe(false);
  });

  it('should handle SSL configuration as string "1"', () => {
    process.env.DB_SSL = '1';

    const config = databaseConfig();

    expect(config.ssl).toBe(false);
  });

  it('should handle SSL configuration as string "0"', () => {
    process.env.DB_SSL = '0';

    const config = databaseConfig();

    expect(config.ssl).toBe(false);
  });

  it('should handle SSL configuration as boolean true', () => {
    process.env.DB_SSL = 'true';

    const config = databaseConfig();

    expect(config.ssl).toEqual({ rejectUnauthorized: false });
  });

  it('should handle SSL configuration as boolean false', () => {
    process.env.DB_SSL = 'false';

    const config = databaseConfig();

    expect(config.ssl).toBe(false);
  });

  it('should handle invalid PORT values gracefully', () => {
    process.env.DB_PORT = 'invalid';

    const config = databaseConfig();

    expect(config.port).toBe(5432); // Should fall back to default
  });

  it('should handle empty string values', () => {
    process.env.DB_HOST = '';
    process.env.DB_USERNAME = '';
    process.env.DB_PASSWORD = '';
    process.env.DB_NAME = '';

    const config = databaseConfig();

    expect(config).toEqual({
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'password',
      name: 'payment_system',
      ssl: false,
    });
  });

  it('should handle very long database names', () => {
    const longName = 'a'.repeat(1000);
    process.env.DB_NAME = longName;

    const config = databaseConfig();

    expect(config.name).toBe(longName);
  });

  it('should handle special characters in credentials', () => {
    process.env.DB_USERNAME = 'user@domain.com';
    process.env.DB_PASSWORD = 'p@ssw0rd!#$%^&*()';

    const config = databaseConfig();

    expect(config.username).toBe('user@domain.com');
    expect(config.password).toBe('p@ssw0rd!#$%^&*()');
  });

  it('should handle IPv6 addresses', () => {
    process.env.DB_HOST = '2001:db8::1';

    const config = databaseConfig();

    expect(config.host).toBe('2001:db8::1');
  });

  it('should handle localhost variations', () => {
    const variations = ['localhost', '127.0.0.1', '0.0.0.0'];

    variations.forEach((host) => {
      process.env.DB_HOST = host;
      const config = databaseConfig();
      expect(config.host).toBe(host);
    });
  });
});
