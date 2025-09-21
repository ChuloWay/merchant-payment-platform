import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    if (!request.headers) {
      request.headers = {};
    }

    const existingCorrelationId = request.headers['x-correlation-id'] || 
                                  request.headers['X-Correlation-ID'];

    if (!existingCorrelationId) {
      request.headers['x-correlation-id'] = uuidv4();
    }

    return next.handle().pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }
}
