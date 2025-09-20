import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, body, query, params } = request;
    const correlationId = request.headers['x-correlation-id'] as string;

    const startTime = Date.now();

    this.logger.log(
      `Incoming Request: ${method} ${url} - Correlation ID: ${correlationId}`,
    );

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.logger.log(
          `Outgoing Response: ${method} ${url} - Status: ${response.statusCode} - Duration: ${duration}ms - Correlation ID: ${correlationId}`,
        );
      }),
    );
  }
}
