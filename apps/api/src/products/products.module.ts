import { Module, forwardRef } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { StorageModule } from '../storage/storage.module';
import { TikTokIntegrationModule } from '../tiktok-integration/tiktok-integration.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { StoreController } from './store.controller';
import { StorePublicController } from './store-public.controller';

@Module({
  imports: [StorageModule, BookingsModule, forwardRef(() => TikTokIntegrationModule)],
  controllers: [StorePublicController, StoreController, ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
