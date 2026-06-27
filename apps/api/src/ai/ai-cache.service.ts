import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class AiCacheService {
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis(config.getOrThrow<string>('REDIS_URL'));
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(`ai:${key}`);
    return value ? JSON.parse(value) as T : null;
  }

  async set<T>(key: string, value: T, ttlSeconds = 300) {
    await this.redis.set(`ai:${key}`, JSON.stringify(value), 'EX', ttlSeconds);
  }
}
