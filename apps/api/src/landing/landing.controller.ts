import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LandingOffersService } from './landing-offers.service';
import { LandingPageService } from './landing-page.service';

@ApiTags('Landing')
@Controller('landing')
export class LandingController {
  constructor(
    private readonly offers: LandingOffersService,
    private readonly page: LandingPageService,
  ) {}

  @Get('offers')
  @ApiOperation({ summary: 'Public active landing page offers' })
  listOffers() {
    return this.offers.listActive();
  }

  @Get('content')
  @ApiOperation({ summary: 'Public landing page editable content + section visibility' })
  content() {
    return this.page.getPublic();
  }
}
