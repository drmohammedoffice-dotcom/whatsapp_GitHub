import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

export function requestIdMiddleware(request: Request, response: Response, next: NextFunction) {
  const requestId = request.header('x-request-id') ?? randomUUID();
  response.setHeader('x-request-id', requestId);
  (request as Request & { requestId?: string }).requestId = requestId;
  next();
}
