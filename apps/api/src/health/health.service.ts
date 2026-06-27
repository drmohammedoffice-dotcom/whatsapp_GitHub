import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  live() {
    return { status: 'ok', service: 'api', uptime: process.uptime(), timestamp: new Date().toISOString() };
  }

  async ready() {
    const checks = await Promise.allSettled([this.checkDatabase(), this.checkRedis()]);
    const details = {
      database: checks[0].status === 'fulfilled' ? 'ok' : 'error',
      redis: checks[1].status === 'fulfilled' ? 'ok' : 'error',
    };
    const healthy = Object.values(details).every((status) => status === 'ok');
    return { status: healthy ? 'ok' : 'degraded', details, timestamp: new Date().toISOString() };
  }

  private async checkDatabase() {
    await this.prisma.$queryRaw`SELECT 1`;
  }

  private async checkRedis() {
    const redis = new Redis(this.config.getOrThrow<string>('REDIS_URL'), { maxRetriesPerRequest: 1, lazyConnect: true });
    try {
      await redis.connect();
      await redis.ping();
    } finally {
      redis.disconnect();
    }
  }
}
