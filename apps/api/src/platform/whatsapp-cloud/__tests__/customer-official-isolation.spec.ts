import { BadRequestException } from '@nestjs/common';
import { WhatsAppCloudService } from '../whatsapp-cloud.service';

describe('customer WhatsApp Cloud isolation', () => {
  it('refuses to attach the official Chatloora sender token to a customer workspace', async () => {
    const service = Object.create(WhatsAppCloudService.prototype) as WhatsAppCloudService;
    await expect(service.connectSharedWaba('team-a', { wabaId: '123456789012345' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
