import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10) || 3000,
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  rateLimitTtl: process.env.RATE_LIMIT_TTL !== undefined ? (parseInt(process.env.RATE_LIMIT_TTL, 10) || 60) : 60,
  rateLimitMax: process.env.RATE_LIMIT_MAX !== undefined ? (parseInt(process.env.RATE_LIMIT_MAX, 10) || 100) : 100,
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
  ],
}));
