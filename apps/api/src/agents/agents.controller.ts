import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@watsapp/database';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentPrincipal } from '../common/current-principal.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AuthenticatedPrincipal } from '../common/principal';
import { AgentsService } from './agents.service';
import { UpdateAgentStatusDto, UpdateMemberDto } from './dto/agents.dto';

@ApiTags('Agents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('agents')
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get()
  @RequirePermissions(Permission.AGENT_MANAGE)
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.agents.list(principal.teamId);
  }

  @Patch(':userId')
  @RequirePermissions(Permission.AGENT_MANAGE)
  update(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('userId') userId: string, @Body() dto: UpdateMemberDto) {
    return this.agents.updateMember(principal.teamId, principal.userId, userId, dto);
  }

  @Patch('me/status')
  status(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: UpdateAgentStatusDto) {
    return this.agents.updateStatus(principal.teamId, principal.userId!, dto);
  }
}
