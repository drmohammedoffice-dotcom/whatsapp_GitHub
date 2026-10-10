import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ChannelProvider, ChannelStatus, TelegramConnectionStatus } from '@watsapp/database';
import { Api } from 'telegram/tl';
import { RPCError } from 'telegram/errors';
import { AuditService } from '../../audit/audit.service';
import { PlanEntitlementsService } from '../../billing/plan-entitlements.service';
import { EncryptionService } from '../../security/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TELEGRAM_AUTH_TTL_MS } from './telegram-user.constants';
import { TelegramClientManager } from './telegram-client.manager';
import { TelegramUserEventsService } from './telegram-user-events.service';
import { TelegramUserSyncService } from './telegram-user-sync.service';

@Injectable()
export class TelegramUserAuthService {
  private readonly logger = new Logger(TelegramUserAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly clients: TelegramClientManager,
    private readonly events: TelegramUserEventsService,
    private readonly sync: TelegramUserSyncService,
    private readonly audit: AuditService,
    private readonly entitlements: PlanEntitlementsService,
  ) {}

  async sendCode(teamId: string, userId: string, phoneNumber: string) {
    await this.entitlements.assertTelegram(teamId);
    if (!this.clients.isConfigured()) {
      throw new BadRequestException('Telegram MTProto is not configured. Set TELEGRAM_API_ID and TELEGRAM_API_HASH from my.telegram.org');
    }
    const normalized = this.normalizePhoneNumber(phoneNumber);
    if (!/^\+[0-9]{8,15}$/.test(normalized)) {
      throw new BadRequestException('Invalid phone number format. Use country code, e.g. +9647XXXXXXXX');
    }

    await this.prisma.telegramAuthPending.deleteMany({ where: { teamId, userId } });

    const client = await this.clients.createClient('');
    const result = await client.sendCode(
      { apiId: this.clients.apiId, apiHash: this.clients.apiHash },
      normalized,
    );

    const tempSession = this.clients.saveSessionString(client);
    await client.disconnect();

    const pending = await this.prisma.telegramAuthPending.create({
      data: {
        teamId,
        userId,
        phoneNumber: normalized,
        encryptedTempSession: this.encryption.encryptJson(tempSession),
        phoneCodeHash: result.phoneCodeHash,
        expiresAt: new Date(Date.now() + TELEGRAM_AUTH_TTL_MS),
      },
    });

    return { authId: pending.id, phoneNumber: normalized, codeSent: true };
  }

  async verifyCode(teamId: string, userId: string, authId: string, code: string) {
    const pending = await this.loadPending(teamId, userId, authId);
    const client = await this.clients.createClient(this.encryption.decryptJson<string>(pending.encryptedTempSession));

    try {
      await client.invoke(
        new Api.auth.SignIn({
          phoneNumber: pending.phoneNumber,
          phoneCodeHash: pending.phoneCodeHash,
          phoneCode: code.trim(),
        }),
      );
    } catch (error) {
      if (error instanceof RPCError && error.errorMessage === 'SESSION_PASSWORD_NEEDED') {
        const tempSession = this.clients.saveSessionString(client);
        await this.prisma.telegramAuthPending.update({
          where: { id: pending.id },
          data: {
            encryptedTempSession: this.encryption.encryptJson(tempSession),
            expiresAt: new Date(Date.now() + TELEGRAM_AUTH_TTL_MS),
          },
        });
        return { needsPassword: true, authId: pending.id };
      }
      await client.disconnect();
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid verification code');
    }

    return this.finalizeLogin(teamId, userId, pending, client);
  }

  async verifyPassword(teamId: string, userId: string, authId: string, password: string) {
    const pending = await this.loadPending(teamId, userId, authId);
    const client = await this.clients.createClient(this.encryption.decryptJson<string>(pending.encryptedTempSession));

    try {
      await client.signInWithPassword(
        { apiId: this.clients.apiId, apiHash: this.clients.apiHash },
        {
          password: () => Promise.resolve(password),
          onError: () => undefined,
        },
      );
    } catch (error) {
      await client.disconnect();
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid password');
    }

    return this.finalizeLogin(teamId, userId, pending, client);
  }

  private async finalizeLogin(
    teamId: string,
    userId: string,
    pending: { id: string; phoneNumber: string },
    client: import('telegram').TelegramClient,
  ) {
    const me = await client.getMe();
    const sessionString = this.clients.saveSessionString(client);
    const telegramUserId = String(me.id);
    const displayName = [me.firstName, me.lastName].filter(Boolean).join(' ') || me.username || pending.phoneNumber;

    const connection = await this.prisma.telegramConnection.upsert({
      where: { teamId_phoneNumber: { teamId, phoneNumber: pending.phoneNumber } },
      update: {
        connectedByUserId: userId,
        telegramUserId,
        firstName: me.firstName ?? null,
        lastName: me.lastName ?? null,
        username: me.username ?? null,
        encryptedSession: this.encryption.encryptJson(sessionString),
        status: TelegramConnectionStatus.CONNECTED,
        connectedAt: new Date(),
        lastSeenAt: new Date(),
        failureReason: null,
      },
      create: {
        teamId,
        connectedByUserId: userId,
        phoneNumber: pending.phoneNumber,
        telegramUserId,
        firstName: me.firstName ?? null,
        lastName: me.lastName ?? null,
        username: me.username ?? null,
        encryptedSession: this.encryption.encryptJson(sessionString),
        status: TelegramConnectionStatus.CONNECTED,
        connectedAt: new Date(),
        lastSeenAt: new Date(),
      },
    });

    const channel = await this.prisma.channel.upsert({
      where: { teamId_provider_externalId: { teamId, provider: ChannelProvider.TELEGRAM_USER, externalId: telegramUserId } },
      update: {
        name: displayName,
        status: ChannelStatus.CONNECTED,
        telegramConnectionId: connection.id,
        lastSeenAt: new Date(),
        metadata: {
          accountType: 'user',
          phoneNumber: pending.phoneNumber,
          username: me.username,
          telegramUserId,
        },
      },
      create: {
        teamId,
        provider: ChannelProvider.TELEGRAM_USER,
        name: displayName,
        status: ChannelStatus.CONNECTED,
        externalId: telegramUserId,
        telegramConnectionId: connection.id,
        lastSeenAt: new Date(),
        metadata: {
          accountType: 'user',
          phoneNumber: pending.phoneNumber,
          username: me.username,
          telegramUserId,
        },
      },
    });

    await this.prisma.telegramAuthPending.delete({ where: { id: pending.id } });

    this.clients.setClient(connection.id, client);
    await this.events.attachHandlers(connection.id, client, channel.id, teamId);
    this.sync.syncConnection(connection.id).catch((err) => {
      this.logger.warn(`Initial sync failed: ${err instanceof Error ? err.message : String(err)}`);
    });

    await this.audit.log({
      teamId,
      actorUserId: userId,
      action: 'telegram_user.connect',
      resource: 'telegramConnection',
      resourceId: connection.id,
    });

    return {
      connectionId: connection.id,
      channelId: channel.id,
      needsPassword: false,
      profile: {
        firstName: me.firstName,
        lastName: me.lastName,
        username: me.username,
        phoneNumber: pending.phoneNumber,
        telegramUserId,
      },
    };
  }

  private normalizePhoneNumber(raw: string): string {
    let value = raw.trim().replace(/[\s\-()]/g, '');
    if (value.startsWith('*')) value = `+${value.slice(1)}`;
    if (value.startsWith('00')) value = `+${value.slice(2)}`;
    if (!value.startsWith('+')) value = `+${value.replace(/^0+/, '')}`;
    return value;
  }

  private async loadPending(teamId: string, userId: string, authId: string) {
    const pending = await this.prisma.telegramAuthPending.findFirst({
      where: { id: authId, teamId, userId },
    });
    if (!pending) throw new BadRequestException('Auth session not found or expired');
    if (pending.expiresAt.getTime() <= Date.now()) {
      await this.prisma.telegramAuthPending.delete({ where: { id: pending.id } });
      throw new BadRequestException('Verification session expired — request a new code');
    }
    return pending;
  }
}
