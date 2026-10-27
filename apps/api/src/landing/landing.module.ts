import { Module } from '@nestjs/common';
import { LandingController } from './landing.controller';
import { LandingOffersService } from './landing-offers.service';
import { LandingPageService } from './landing-page.service';

@Module({
  controllers: [LandingController],
  providers: [LandingOffersService, LandingPageService],
  exports: [LandingPageService],
})
export class LandingModule {}
