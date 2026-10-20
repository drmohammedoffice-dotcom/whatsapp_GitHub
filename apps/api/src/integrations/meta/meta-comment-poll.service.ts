import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { MetaService } from './meta.service';

/**
 * Meta often fails to deliver comment webhooks reliably (especially Facebook feed).
 * Poll Graph on a short interval so new post comments appear near-instantly.
 */
@Injectable()
export class MetaCommentPollService {
  private readonly logger = new Logger(MetaCommentPollService.name);
  private running = false;

  constructor(private readonly meta: MetaService) {}

  /** ~45s cadence — balances freshness with Instagram Graph rate limits (#80002). */
  @Interval(45_000)
  async pollInstagramComments() {
    if (process.env.PROCESS_ROLE === 'worker' || process.env.DISABLE_META_COMMENT_POLL === '1') {
      return;
    }
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const result = await this.meta.syncPostCommentsAllTeams();
      const total = result.summaries.reduce((sum, row) => sum + row.imported, 0);
      if (total > 0) {
        this.logger.log(`[Meta comment poll] done teams=${result.teams} new=${total}`);
      }
    } catch (error) {
      this.logger.warn(
        `[Meta comment poll] failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
