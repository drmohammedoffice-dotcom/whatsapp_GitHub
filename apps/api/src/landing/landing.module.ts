import { Module } from '@nestjs/common';
import { LandingController } from './landing.controller';
import { LandingOffersService } from './landing-offers.service';

@Module({
  controllers: [LandingController],
  providers: [LandingOffersService],
})
export class LandingModule {}
