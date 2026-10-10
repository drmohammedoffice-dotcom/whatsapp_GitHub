import { Module } from '@nestjs/common';
import { CreativeStudioController } from './creative-studio.controller';
import { CreativeStudioCoreModule } from './creative-studio.core.module';

@Module({
  imports: [CreativeStudioCoreModule],
  controllers: [CreativeStudioController],
})
export class CreativeStudioModule {}
