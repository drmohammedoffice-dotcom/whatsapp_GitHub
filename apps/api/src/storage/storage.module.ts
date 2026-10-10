import { Module } from '@nestjs/common';
import { LocalStorageService } from './local-storage.service';
import { LocalStorageProvider } from './local-storage.provider';
import { CREATIVE_STORAGE } from './storage-provider';

@Module({
  providers: [
    LocalStorageService,
    LocalStorageProvider,
    { provide: CREATIVE_STORAGE, useExisting: LocalStorageProvider },
  ],
  exports: [LocalStorageService, LocalStorageProvider, CREATIVE_STORAGE],
})
export class StorageModule {}
