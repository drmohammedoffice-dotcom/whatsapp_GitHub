import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { StorageModule } from '../storage/storage.module';
import { PartnerJwtGuard } from './partner-jwt.guard';
import { SalesPartnerEmailService } from './sales-partner-email.service';
import { SalesPartnersPublicController, SalesPartnersPortalController } from './sales-partners.controller';
import { SuccessPartnerController } from './success-partner.controller';
import { SalesPartnersService } from './sales-partners.service';

@Module({
  imports: [JwtModule.register({}), StorageModule],
  controllers: [SalesPartnersPublicController, SalesPartnersPortalController, SuccessPartnerController],
  providers: [SalesPartnersService, PartnerJwtGuard, SalesPartnerEmailService],
  exports: [SalesPartnersService],
})
export class SalesPartnersModule {}
