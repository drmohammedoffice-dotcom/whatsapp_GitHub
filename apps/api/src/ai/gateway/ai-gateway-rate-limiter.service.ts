import { Injectable } from '@nestjs/common';
import { AiGatewayConfigService } from './ai-gateway-config';

type WindowCounters = {
  /** Unix-ms timestamps of recent attempts (trimmed periodically). */
  stamps: number[];
};

/**
 * Sliding-window rate limiter per API key (minute / hour / day).
 * Thread-safe for Node's single-threaded event loop: reserve() is sync.
 */
@Injectable()
export class AiGatewayRateLimiterService {
  private readonly windows = new Map<string, WindowCounters>();

  constructor(private readonly gatewayConfig: AiGatewayConfigService) {}

  private bucket(id: string): WindowCounters {
    let row = this.windows.get(id);
    if (!row) {
      row = { stamps: [] };
      this.windows.set(id, row);
    }
    return row;
  }

  private prune(row: WindowCounters, now: number) {
    const dayAgo = now - 24 * 60 * 60_000;
    // Keep at most one day of stamps
    while (row.stamps.length && row.stamps[0]! < dayAgo) {
      row.stamps.shift();
    }
  }

  usage(id: string, now = Date.now()) {
    const row = this.bucket(id);
    this.prune(row, now);
    const minuteAgo = now - 60_000;
    const hourAgo = now - 60 * 60_000;
    const dayAgo = now - 24 * 60 * 60_000;
    let rpm = 0;
    let rph = 0;
    let rpd = 0;
    for (const t of row.stamps) {
      if (t >= dayAgo) rpd += 1;
      if (t >= hourAgo) rph += 1;
      if (t >= minuteAgo) rpm += 1;
    }
    return { rpm, rph, rpd };
  }

  /** True when the key is below soft thresholds. */
  canAccept(id: string, now = Date.now()): boolean {
    const cfg = this.gatewayConfig.get();
    const u = this.usage(id, now);
    return (
      u.rpm < cfg.rateLimitPerMinute &&
      u.rph < cfg.rateLimitPerHour &&
      u.rpd < cfg.rateLimitPerDay
    );
  }

  /** How close the key is to its tightest limit (0 = idle, 1 = at limit). */
  pressure(id: string, now = Date.now()): number {
    const cfg = this.gatewayConfig.get();
    const u = this.usage(id, now);
    return Math.max(
      u.rpm / Math.max(1, cfg.rateLimitPerMinute),
      u.rph / Math.max(1, cfg.rateLimitPerHour),
      u.rpd / Math.max(1, cfg.rateLimitPerDay),
    );
  }

  /** Reserve one request slot for this key (call before HTTP). */
  reserve(id: string, now = Date.now()) {
    const row = this.bucket(id);
    this.prune(row, now);
    row.stamps.push(now);
  }
}
