import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentPrincipal } from '../common/current-principal.decorator';
import { AuthenticatedPrincipal } from '../common/principal';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@ApiTags('API Keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Get()
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.apiKeys.list(principal.teamId);
  }

  @Post()
  create(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: CreateApiKeyDto) {
    return this.apiKeys.create(principal.teamId, dto);
  }

  @Delete(':id')
  revoke(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.apiKeys.revoke(principal.teamId, id);
  }
}
