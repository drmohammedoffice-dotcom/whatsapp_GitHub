import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentPrincipal } from '../common/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../common/principal';
import { AccountDeletionService } from './account-deletion.service';

class DeleteAccountDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;

  @IsString()
  @MaxLength(20)
  confirmation!: string;
}

@ApiTags('Account')
@ApiBearerAuth()
// ThrottlerGuard is global (APP_GUARD); adding it here again would count each request twice.
@UseGuards(JwtAuthGuard)
@Controller('account')
export class AccountController {
  constructor(private readonly deletion: AccountDeletionService) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('delete')
  @ApiOperation({ summary: 'Permanently delete the signed-in account (store-policy self-service deletion)' })
  deleteAccount(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: DeleteAccountDto, @Req() req: Request) {
    return this.deletion.deleteAccount(principal.userId!, dto.password, dto.confirmation, req.ip);
  }
}
