import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LandingOffersService } from './landing-offers.service';

@ApiTags('Landing')
@Controller('landing')
export class LandingController {
  constructor(private readonly offers: LandingOffersService) {}

  @Get('offers')
  @ApiOperation({ summary: 'Public active landing page offers' })
  listOffers() {
    return this.offers.listActive();
  }
}
