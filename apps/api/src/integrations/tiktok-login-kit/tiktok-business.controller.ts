import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentPrincipal } from '../../common/current-principal.decorator';
import { AuthenticatedPrincipal } from '../../common/principal';
import { TikTokBusinessService } from './tiktok-business.service';

@ApiTags('TikTok Business')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('integrations/tiktok-business')
export class TikTokBusinessController {
  constructor(private readonly business: TikTokBusinessService) {}

  @Get()
  @ApiOperation({ summary: 'TikTok Business Center connection status and synced advertisers' })
  status(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.business.getStatus(principal.userId!);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sync Business Center and advertiser accounts from TikTok Marketing API' })
  sync(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.business.syncBusinessAccounts(principal.userId!, principal.teamId);
  }
}
