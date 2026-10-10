import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { IsString, MinLength } from 'class-validator';
import { Request } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentPrincipal } from '../common/current-principal.decorator';
import type { AuthenticatedPrincipal } from '../common/principal';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordConfirmDto, ResetPasswordRequestDto } from './dto/reset-password.dto';
import { ResendOtpDto, VerifyOtpDto } from './dto/verify-otp.dto';

class UpdateAccountDto {
  @IsString()
  @MinLength(2)
  name!: string;
}

class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

@ApiTags('Authentication')
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, req.ip, req.headers['user-agent']);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('register/verify')
  verifyRegister(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    return this.auth.verifyRegistration(dto.verificationId, dto.code, req.ip, req.headers['user-agent']);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, req.ip, req.headers['user-agent']);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login/verify')
  verifyLogin(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    return this.auth.verifyLogin(dto.verificationId, dto.code, req.ip, req.headers['user-agent']);
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('otp/resend')
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.auth.resendOtp(dto.verificationId);
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('otp/email-fallback')
  emailFallback(@Body() dto: ResendOtpDto) {
    return this.auth.fallbackOtpToEmail(dto.verificationId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, req.ip, req.headers['user-agent']);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('reset-password')
  requestReset(@Body() dto: ResetPasswordRequestDto) {
    return this.auth.requestPasswordReset(dto.email);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('reset-password/verify')
  verifyPasswordReset(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyPasswordResetOtp(dto.verificationId, dto.code);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('reset-password/confirm')
  confirmReset(@Body() dto: ResetPasswordConfirmDto) {
    return this.auth.confirmPasswordReset(dto.token, dto.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.auth.getAccount(principal.userId!);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: UpdateAccountDto) {
    return this.auth.updateAccount(principal.userId!, dto.name);
  }

  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(principal.userId!, dto.currentPassword, dto.newPassword);
  }
}
