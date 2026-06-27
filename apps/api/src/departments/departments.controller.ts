import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@watsapp/database';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentPrincipal } from '../common/current-principal.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AuthenticatedPrincipal } from '../common/principal';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto, DepartmentMemberDto } from './dto/departments.dto';

@ApiTags('Departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  @RequirePermissions(Permission.DEPARTMENT_MANAGE)
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal) { return this.departments.list(principal.teamId); }

  @Post()
  @RequirePermissions(Permission.DEPARTMENT_MANAGE)
  create(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: CreateDepartmentDto) { return this.departments.create(principal.teamId, dto); }

  @Post(':id/members')
  @RequirePermissions(Permission.DEPARTMENT_MANAGE)
  add(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string, @Body() dto: DepartmentMemberDto) { return this.departments.addMember(principal.teamId, id, dto.teamMemberId); }

  @Delete(':id/members/:teamMemberId')
  @RequirePermissions(Permission.DEPARTMENT_MANAGE)
  remove(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string, @Param('teamMemberId') teamMemberId: string) { return this.departments.removeMember(principal.teamId, id, teamMemberId); }
}
