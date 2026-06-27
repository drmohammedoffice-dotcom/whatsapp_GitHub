import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentPrincipal } from '../common/current-principal.decorator';
import { AuthenticatedPrincipal } from '../common/principal';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { WebhooksService } from './webhooks.service';

@ApiTags('Webhooks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get()
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.webhooks.list(principal.teamId);
  }

  @Post()
  create(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: CreateWebhookDto) {
    return this.webhooks.create(principal.teamId, dto);
  }

  @Delete(':id')
  remove(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.webhooks.remove(principal.teamId, id);
  }
}
