import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ChannelPurpose, WhatsAppConnectionLogEvent, WhatsAppSessionStatus } from '@watsapp/database';
import { AuditService } from '../../audit/audit.service';
import { fromPrismaPurpose, isTrackingChannel, toPrismaPurpose } from '../../channels/channel-purpose';
import { ChannelsService } from '../../channels/channels.service';
import { BaileysCredentialStore } from './baileys-credential.store';
import { BaileysProvider } from './baileys.provider';
import { WhatsAppEventsService } from './events.service';
import { SessionContext } from './interfaces/session.interface';
import { QrGateway } from './qr.gateway';
import { SessionManager } from './session.manager';
import { phoneFromJid, resolveStoredPhone, toWhatsAppJid } from './utils/disconnect.util';
import { WhatsAppRepository } from './whatsapp.repository';

@Injectable()
export class WhatsAppService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly starting = new Set<string>();

  constructor(
    private readonly repository: WhatsAppRepository,
    private readonly credentials: BaileysCredentialStore,
    private readonly baileysProvider: BaileysProvider,
    private readonly sessionManager: SessionManager,
    private readonly events: WhatsAppEventsService,
    private readonly qrGateway: QrGateway,
    private readonly channels: ChannelsService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    this.sessionManager.setReconnectHandler(async (context) => {
      await this.startSocket(context, true);
    });
    this.sessionManager.setHeartbeatHandler(async (context) => {
      await this.repository.updateSession(context.sessionId, { lastHeartbeatAt: new Date(), lastSeenAt: new Date() });
    });
    void this.restoreAllSessions();
  }

  private async restoreAllSessions() {
    const sessions = await this.repository.findRestorableSessions();
    // Inbox must come online before TikTok tracking for the same phone, otherwise
    // Baileys "conflict: replaced" steals the Inbox socket and new chats never appear.
    const inbox = sessions.filter((s) => s.purpose === ChannelPurpose.INBOX);
    const tracking = sessions.filter((s) => s.purpose === ChannelPurpose.TRACKING);
    const ordered = [...inbox, ...tracking];
    this.logger.log(
      `Restoring ${ordered.length} WhatsApp session(s) (inbox=${inbox.length}, tracking=${tracking.length}) staggered`,
    );

    for (let i = 0; i < ordered.length; i += 1) {
      const session = ordered[i]!;
      try {
        await this.startSocket(
          { teamId: session.teamId, sessionId: session.id, userId: session.createdByUserId ?? undefined },
          true,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to restore session ${session.id} (${session.purpose}): ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      // Give WhatsApp time to settle before opening the next linked device.
      if (i < ordered.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, session.purpose === ChannelPurpose.INBOX ? 2000 : 3500));
      }
    }
  }

  /** Inbox / Integrations → WhatsApp only. */
  list(teamId: string, userId?: string) {
    return this.repository.listSessions(teamId, userId, ChannelPurpose.INBOX);
  }

  listTracking(teamId: string, userId?: string) {
    return this.repository.listSessions(teamId, userId, ChannelPurpose.TRACKING);
  }

  async connect(
    teamId: string,
    userId?: string,
    displayName?: string,
    sessionId?: string,
    options?: { purpose?: 'inbox' | 'tracking'; integrationId?: string },
  ) {
    const purpose = toPrismaPurpose(options?.purpose ?? 'inbox');
    if (sessionId) {
      const session = await this.ensureSession(teamId, sessionId, purpose);
      if (session.status === WhatsAppSessionStatus.CONNECTED && this.sessionManager.hasSocket(sessionId)) {
        throw new ConflictException('Already connected');
      }
      await this.startSocket({ teamId, sessionId, userId }, false);
      return this.getStatus(teamId, sessionId, purpose);
    }

    const session = await this.repository.createSession(teamId, userId, displayName, purpose);
    await this.channels.ensureWhatsAppChannel(teamId, session.id, {
      purpose: fromPrismaPurpose(purpose),
      integrationId: options?.integrationId,
    });
    await this.audit.log({
      teamId,
      actorUserId: userId,
      action: purpose === ChannelPurpose.TRACKING ? 'whatsapp.tracking.connect' : 'whatsapp.connect',
      resource: 'WhatsAppSession',
      resourceId: session.id,
    });
    await this.repository.logConnection({
      teamId,
      sessionId: session.id,
      event: WhatsAppConnectionLogEvent.CONNECTING,
      message: purpose === ChannelPurpose.TRACKING ? 'TikTok tracking connection initiated' : 'Connection initiated',
    });
    await this.startSocket({ teamId, sessionId: session.id, userId }, false);
    return this.getStatus(teamId, session.id, purpose);
  }

  async getQr(teamId: string, sessionId: string, purpose?: ChannelPurpose) {
    const session = await this.ensureSession(teamId, sessionId, purpose);
    if (session.status === WhatsAppSessionStatus.CONNECTED) {
      throw new BadRequestException('Session already connected');
    }
    if (!session.qrCode) {
      await this.startSocket({ teamId, sessionId }, false);
      const refreshed = await this.ensureSession(teamId, sessionId);
      if (!refreshed.qrCode) throw new BadRequestException('QR not available yet. Retry shortly.');
      return { sessionId, qrCode: refreshed.qrCode, status: refreshed.status, expiresAt: refreshed.qrCodeUpdatedAt };
    }
    return { sessionId, qrCode: session.qrCode, status: session.status, expiresAt: session.qrCodeUpdatedAt };
  }

  async getStatus(teamId: string, sessionId: string, purpose?: ChannelPurpose) {
    const session = await this.ensureSession(teamId, sessionId, purpose);
    return {
      sessionId: session.id,
      purpose: fromPrismaPurpose(session.purpose),
      status: session.status,
      displayName: session.displayName,
      phoneNumber: session.phoneNumber,
      profilePhotoUrl: session.profilePhotoUrl,
      connectedAt: session.connectedAt,
      lastSeenAt: session.lastSeenAt,
      failureReason: session.failureReason,
      isLive: this.sessionManager.hasSocket(sessionId),
    };
  }

  async getProfile(teamId: string, sessionId: string, purpose?: ChannelPurpose) {
    const session = await this.ensureSession(teamId, sessionId, purpose);
    return {
      sessionId: session.id,
      displayName: session.displayName,
      phoneNumber: session.phoneNumber,
      jid: session.jid,
      profilePhotoUrl: session.profilePhotoUrl,
      status: session.status,
      connectedAt: session.connectedAt,
      lastSeenAt: session.lastSeenAt,
    };
  }

  async disconnect(teamId: string, sessionId: string, userId?: string, purpose?: ChannelPurpose) {
    await this.ensureSession(teamId, sessionId, purpose);
    await this.stopSocket(sessionId, true);
    await this.repository.updateSession(sessionId, {
      status: WhatsAppSessionStatus.DISCONNECTED,
      disconnectedAt: new Date(),
      qrCode: null,
    });
    await this.channels.syncWhatsAppStatus(teamId, sessionId, WhatsAppSessionStatus.DISCONNECTED);
    await this.repository.logConnection({
      teamId,
      sessionId,
      event: WhatsAppConnectionLogEvent.DISCONNECTED,
      message: 'Manual disconnect',
    });
    this.qrGateway.emitDisconnected(teamId, { sessionId, status: WhatsAppSessionStatus.DISCONNECTED });
    await this.audit.log({ teamId, actorUserId: userId, action: 'whatsapp.disconnect', resource: 'WhatsAppSession', resourceId: sessionId });
    return this.getStatus(teamId, sessionId);
  }

  async reconnect(teamId: string, sessionId: string, userId?: string, purpose?: ChannelPurpose) {
    await this.ensureSession(teamId, sessionId, purpose);
    await this.stopSocket(sessionId, false);
    await this.repository.updateSession(sessionId, { failureReason: null, qrCode: null });
    await this.startSocket({ teamId, sessionId, userId }, false);
    await this.audit.log({ teamId, actorUserId: userId, action: 'whatsapp.reconnect', resource: 'WhatsAppSession', resourceId: sessionId });
    return this.getStatus(teamId, sessionId, purpose);
  }

  async deleteSession(teamId: string, sessionId: string, userId?: string, purpose?: ChannelPurpose) {
    await this.ensureSession(teamId, sessionId, purpose);
    await this.channels.deleteByWhatsAppSessionId(teamId, sessionId);
    await this.stopSocket(sessionId, true);
    try {
      await this.credentials.purge(sessionId);
    } catch (error) {
      this.logger.warn(`Credential purge failed for ${sessionId}: ${String(error)}`);
    }
    await this.repository.deleteSession(sessionId);
    await this.audit.log({ teamId, actorUserId: userId, action: 'whatsapp.delete', resource: 'WhatsAppSession', resourceId: sessionId });
    return { deleted: true, sessionId };
  }

  getChats(teamId: string, sessionId: string) {
    return this.ensureSession(teamId, sessionId, ChannelPurpose.INBOX).then(() => this.repository.listChats(teamId, sessionId));
  }

  getMessages(teamId: string, sessionId: string, chatId?: string) {
    return this.ensureSession(teamId, sessionId, ChannelPurpose.INBOX).then(() => this.repository.listMessages(teamId, sessionId, chatId));
  }

  getConnectionLogs(teamId: string, sessionId: string) {
    return this.ensureSession(teamId, sessionId).then(() => this.repository.listConnectionLogs(teamId, sessionId));
  }

  // Legacy API compatibility — Inbox only
  create(teamId: string, displayName?: string, userId?: string) {
    return this.connect(teamId, userId, displayName, undefined, { purpose: 'inbox' });
  }

  async send(teamId: string, sessionId: string, jid: string, content: Record<string, unknown>) {
    await this.ensureSession(teamId, sessionId, ChannelPurpose.INBOX);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const socket = await this.ensureLiveSocket({ teamId, sessionId }, attempt > 0);
        return (await socket.sendMessage(toWhatsAppJid(jid), content)) as { key?: { id?: string } };
      } catch (error) {
        if (attempt === 0 && this.isSendConnectionError(error)) {
          await this.stopSocket(sessionId, false);
          continue;
        }
        throw error;
      }
    }
    throw new BadRequestException('WhatsApp is not connected. Close other WhatsApp Web sessions and retry.');
  }

  isSessionLive(sessionId: string) {
    return Boolean(this.sessionManager.getSocket(sessionId)?.user?.id);
  }

  async resolveSessionPhoneNumber(teamId: string, sessionId: string): Promise<string | null> {
    const session = await this.repository.findSessionForTeam(teamId, sessionId);
    if (!session) return null;

    const stored = resolveStoredPhone({
      phoneNumber: session.phoneNumber,
      jid: session.jid,
    });
    if (stored) return stored;

    const socket = this.sessionManager.getSocket(sessionId);
    const jid = socket?.user?.id ?? session.jid;
    if (!jid) return null;

    let phone = phoneFromJid(jid);
    if (!phone && jid.includes('@lid')) {
      phone = await this.resolvePhoneNumber(teamId, sessionId, jid);
    }
    if (phone) {
      await this.repository.clearPhoneForOtherSessions(teamId, sessionId, phone, session.purpose);
      await this.repository.updateSession(sessionId, { phoneNumber: phone, jid });
      const channel = await this.channels.ensureWhatsAppChannel(teamId, sessionId, {
        purpose: fromPrismaPurpose(session.purpose),
      });
      if (session.purpose === ChannelPurpose.TRACKING || isTrackingChannel(channel)) {
        await this.channels.updateTrackingPhoneLabel(channel.id, phone);
      }
    }
    return phone;
  }

  async ensureLiveSocket(context: SessionContext, force = false) {
    if (!force) {
      const existing = this.sessionManager.getSocket(context.sessionId);
      if (existing?.user?.id) return existing;
    }
    await this.stopSocket(context.sessionId, false);
    return this.startSocket(context, true);
  }

  /**
   * Resolve the real phone number for a contact JID. Modern WhatsApp may deliver
   * messages with a LID identifier (e.g. "265570863849575@lid") instead of the
   * actual phone JID. For LIDs we look up the WhatsApp LID↔PN mapping; for normal
   * phone JIDs we simply return the digits.
   */
  async resolvePhoneNumber(teamId: string, sessionId: string, jid?: string | null): Promise<string | null> {
    if (!jid) return null;
    const isLid = jid.includes('@lid');
    if (!isLid) {
      return phoneFromJid(jid);
    }
    try {
      await this.ensureSession(teamId, sessionId);
      const socket =
        this.sessionManager.getSocket(sessionId) ?? (await this.startSocket({ teamId, sessionId }, false));
      const lidMapping = (socket as unknown as {
        signalRepository?: { lidMapping?: { getPNForLID?: (lid: string) => Promise<string | null> } };
      }).signalRepository?.lidMapping;
      if (lidMapping?.getPNForLID) {
        const pn = await lidMapping.getPNForLID(jid);
        const phone = phoneFromJid(pn);
        if (phone) return phone;
      }
    } catch (error) {
      this.logger.warn(
        `Failed to resolve phone number for LID ${jid}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return null;
  }

  private async startSocket(context: SessionContext, restored: boolean) {
    const { teamId, sessionId } = context;

    const live = this.sessionManager.getSocket(sessionId);
    if (live?.user?.id) return live;

    if (this.starting.has(sessionId)) {
      for (let i = 0; i < 30; i++) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        const socket = this.sessionManager.getSocket(sessionId);
        if (socket?.user?.id) return socket;
        if (!this.starting.has(sessionId)) break;
      }
      const socket = this.sessionManager.getSocket(sessionId);
      if (socket?.user?.id) return socket;
    }

    if (this.sessionManager.hasSocket(sessionId)) {
      await this.stopSocket(sessionId, false);
    }

    this.starting.add(sessionId);
    try {
      await this.repository.updateSession(sessionId, { status: WhatsAppSessionStatus.CONNECTING, failureReason: null });
      await this.channels.syncWhatsAppStatus(teamId, sessionId, WhatsAppSessionStatus.CONNECTING);
      this.qrGateway.emitStatus(teamId, sessionId, WhatsAppSessionStatus.CONNECTING);

      const bundle = await this.baileysProvider.createSocket(sessionId);
      this.sessionManager.setSocket(sessionId, bundle.socket);
      this.events.bindSocket(context, bundle, restored);
      return bundle.socket;
    } finally {
      this.starting.delete(sessionId);
    }
  }

  private async stopSocket(sessionId: string, logout: boolean) {
    this.sessionManager.clearReconnect(sessionId);
    this.sessionManager.clearHeartbeat(sessionId);
    const socket = this.sessionManager.getSocket(sessionId);
    if (!socket) return;
    if (logout) {
      try {
        await socket.logout?.();
      } catch (error) {
        this.logger.warn(`Logout failed for ${sessionId}: ${String(error)}`);
      }
    }
    socket.end?.();
    this.sessionManager.removeSocket(sessionId);
  }

  private async ensureSession(teamId: string, sessionId: string, purpose?: ChannelPurpose) {
    const session = await this.repository.findSessionForTeam(teamId, sessionId);
    if (!session) throw new NotFoundException('WhatsApp session not found');
    if (purpose && session.purpose !== purpose) {
      throw new ForbiddenException(
        `This WhatsApp session belongs to ${fromPrismaPurpose(session.purpose)} and cannot be managed from ${fromPrismaPurpose(purpose)}`,
      );
    }
    return session;
  }

  private isSendConnectionError(error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return /connection closed|precondition required|conflict|not connected|stream errored/i.test(msg);
  }
}
