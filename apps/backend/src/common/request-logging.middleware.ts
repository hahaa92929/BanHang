import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Response } from 'express';
import { RequestWithUser } from './interfaces/request-with-user.interface';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  use(request: RequestWithUser, response: Response, next: NextFunction) {
    const startedAt = process.hrtime.bigint();
    request.requestId = request.headers['x-request-id']?.toString() || randomUUID();
    response.setHeader('x-request-id', request.requestId);

    response.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const payload = {
        timestamp: new Date().toISOString(),
        level: response.statusCode >= 500 ? 'error' : response.statusCode >= 400 ? 'warn' : 'info',
        service: 'backend',
        requestId: request.requestId,
        userId: request.user?.sub ?? null,
        method: request.method,
        path: request.originalUrl,
        ip: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
        duration: Math.round(durationMs),
        status: response.statusCode,
      };

      console.log(JSON.stringify(payload));
    });

    next();
  }
}
