import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DevicesController } from './devices.controller';
import { PushService } from './push.service';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [DevicesController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
