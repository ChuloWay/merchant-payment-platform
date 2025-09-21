import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { MerchantsService } from '../../modules/merchants/merchants.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private readonly merchantsService: MerchantsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'] || request.headers['X-API-Key'] || request.headers['X-API-KEY'] as string;
    
    // Skip API key validation for certain paths
    const skipPaths = ['/api/v1/health', '/api/v1/docs', '/api/v1/merchants'];
    const currentPath = request.url;
    
    // Check if current path should skip API key validation
    const shouldSkip = skipPaths.some(path => currentPath.startsWith(path));
    if (shouldSkip) {
      return true;
    }

    if (!apiKey) {
      this.logger.warn('API key missing from request');
      throw new UnauthorizedException('API key is required');
    }

    try {
      const merchant = await this.merchantsService.findByApiKey(apiKey);

      if (!merchant || !merchant.isActive) {
        this.logger.warn(
          `Invalid or inactive API key: ${apiKey.substring(0, 8)}...`,
        );
        throw new UnauthorizedException('Invalid API key');
      }

      request.merchant = merchant;
      return true;
    } catch (error) {
      this.logger.error(`API key validation failed: ${error.message}`);
      throw new UnauthorizedException('Invalid API key');
    }
  }
}
