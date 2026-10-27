import { Body, Controller, Delete, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentPrincipal } from '../common/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../common/principal';
import { PushService } from './push.service';

class RegisterDeviceDto {
  @IsString()
  @MaxLength(200)
  token!: string;

  @IsIn(['ios', 'android'])
  platform!: 'ios' | 'android';

  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;
}

class UnregisterDeviceDto {
  @IsString()
  @MaxLength(200)
  token!: string;
}

/** Push token registration from the ChatLoora mobile app (via the WebView bridge). */
@ApiTags('Devices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly push: PushService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async register(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: RegisterDeviceDto) {
    if (!this.push.isValidToken(dto.token)) throw new BadRequestException('Invalid push token');
    await this.push.register(principal.userId!, principal.teamId, dto.token, dto.platform, dto.appVersion);
    return { registered: true };
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  async unregister(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: UnregisterDeviceDto) {
    await this.push.unregister(principal.userId!, dto.token);
    return { unregistered: true };
  }
}
