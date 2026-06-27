import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { RequestWithPrincipal } from '../common/principal';
import { PrismaService } from '../prisma/prisma.service';
import { ApiKeyCryptoService } from '../security/api-key-crypto.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService, private readonly crypto: ApiKeyCryptoService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & RequestWithPrincipal>();
    const apiKey = request.header('x-api-key');
    if (!apiKey) throw new UnauthorizedException('Missing API key');

    const keyHash = this.crypto.hash(apiKey);
    const record = await this.prisma.apiKey.findUnique({ where: { keyHash } });
    if (!record || record.revokedAt || (record.expiresAt && record.expiresAt < new Date())) {
      throw new UnauthorizedException('Invalid API key');
    }

    await this.prisma.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
    request.principal = { teamId: record.teamId, apiKeyId: record.id, scopes: record.scopes };
    return true;
  }
}
