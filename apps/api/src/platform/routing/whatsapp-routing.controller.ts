import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission, Prisma, WhatsAppRoutingStrategy } from '@watsapp/database';
import { IsArray, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentPrincipal } from '../../common/current-principal.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthenticatedPrincipal } from '../../common/principal';
import { PrismaService } from '../../prisma/prisma.service';

class PoolMemberDto {
  @IsString()
  accountId!: string;

  @IsOptional()
  weight?: number;

  @IsOptional()
  @IsArray()
  countryCodes?: string[];
}

class CreateRoutingRuleDto {
  @IsString()
  name!: string;

  @IsEnum(WhatsAppRoutingStrategy)
  strategy!: WhatsAppRoutingStrategy;

  @IsOptional()
  config?: Record<string, unknown>;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PoolMemberDto)
  pool?: PoolMemberDto[];
}

@ApiTags('WhatsApp Routing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('routing/whatsapp')
export class WhatsAppRoutingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions(Permission.ROUTING_MANAGE)
  list(@CurrentPrincipal() p: AuthenticatedPrincipal) {
    return this.prisma.whatsAppRoutingRule.findMany({
      where: { teamId: p.teamId },
      include: { poolMembers: { include: { account: { select: { id: true, name: true, phoneNumber: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post()
  @RequirePermissions(Permission.ROUTING_MANAGE)
  async create(@CurrentPrincipal() p: AuthenticatedPrincipal, @Body() dto: CreateRoutingRuleDto) {
    return this.prisma.$transaction(async (tx) => {
      const rule = await tx.whatsAppRoutingRule.create({
        data: {
          teamId: p.teamId,
          name: dto.name,
          strategy: dto.strategy,
          config: (dto.config ?? {}) as Prisma.InputJsonValue,
        },
      });
      if (dto.pool?.length) {
        await tx.whatsAppRoutingPoolMember.createMany({
          data: dto.pool.map((m, i) => ({
            routingRuleId: rule.id,
            accountId: m.accountId,
            weight: m.weight ?? 1,
            countryCodes: m.countryCodes ?? [],
            sortOrder: i,
          })),
        });
      }
      return tx.whatsAppRoutingRule.findUnique({
        where: { id: rule.id },
        include: { poolMembers: { include: { account: true } } },
      });
    });
  }

  @Patch(':id/toggle')
  @RequirePermissions(Permission.ROUTING_MANAGE)
  toggle(@CurrentPrincipal() p: AuthenticatedPrincipal, @Param('id') id: string, @Body('active') active: boolean) {
    return this.prisma.whatsAppRoutingRule.updateMany({
      where: { id, teamId: p.teamId },
      data: { active },
    });
  }
}
