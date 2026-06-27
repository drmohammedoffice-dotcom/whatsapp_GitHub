import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@watsapp/database';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentPrincipal } from '../common/current-principal.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AuthenticatedPrincipal } from '../common/principal';
import { ContactsService } from './contacts.service';
import { CreateLabelDto, UpdateContactDto } from './dto/contact.dto';

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  @RequirePermissions(Permission.CONTACT_READ)
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Query('search') search?: string) {
    return this.contacts.list(principal.teamId, search);
  }

  @Get('labels')
  @RequirePermissions(Permission.CONTACT_READ)
  labels(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.contacts.labels(principal.teamId);
  }

  @Post('labels')
  @RequirePermissions(Permission.CONTACT_WRITE)
  createLabel(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: CreateLabelDto) {
    return this.contacts.createLabel(principal.teamId, dto);
  }

  @Get('custom-fields')
  @RequirePermissions(Permission.CONTACT_READ)
  customFields(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.contacts.customFields(principal.teamId);
  }

  @Get(':id')
  @RequirePermissions(Permission.CONTACT_READ)
  get(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.contacts.get(principal.teamId, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.CONTACT_WRITE)
  update(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.contacts.update(principal.teamId, id, dto);
  }
}
