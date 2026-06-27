import { Injectable } from '@nestjs/common';
import { WhatsAppSessionStatus } from '@watsapp/database';
import { SOCKET_EVENTS } from '@watsapp/shared';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { QrPayload, StatusPayload } from './interfaces/session.interface';

@Injectable()
export class QrGateway {
  constructor(private readonly realtime: RealtimeGateway) {}

  emitQrGenerated(teamId: string, payload: QrPayload) {
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.QR_GENERATED, payload);
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.QR_UPDATED, payload);
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.QR_UPDATED_LEGACY, payload);
  }

  emitQrUpdated(teamId: string, payload: QrPayload) {
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.QR_UPDATED, payload);
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.QR_UPDATED_LEGACY, payload);
  }

  emitConnected(teamId: string, payload: StatusPayload) {
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.WHATSAPP_CONNECTED, payload);
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.STATUS_CHANGED, payload);
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.SESSION_STATUS_UPDATED, payload);
  }

  emitDisconnected(teamId: string, payload: StatusPayload) {
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.WHATSAPP_DISCONNECTED, payload);
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.STATUS_CHANGED, payload);
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.SESSION_STATUS_UPDATED, payload);
  }

  emitReconnecting(teamId: string, payload: StatusPayload) {
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.WHATSAPP_RECONNECTING, payload);
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.STATUS_CHANGED, payload);
  }

  emitSessionRestored(teamId: string, payload: StatusPayload) {
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.SESSION_RESTORED, payload);
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.STATUS_CHANGED, payload);
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.SESSION_STATUS_UPDATED, payload);
  }

  emitMessageReceived(teamId: string, payload: unknown) {
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.MESSAGE_RECEIVED, payload);
  }

  emitStatus(teamId: string, sessionId: string, status: WhatsAppSessionStatus, failureReason?: string | null) {
    const payload: StatusPayload = { sessionId, status, failureReason };
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.STATUS_CHANGED, payload);
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.SESSION_STATUS_UPDATED, payload);
    if (status === WhatsAppSessionStatus.CONNECTED) this.emitConnected(teamId, payload);
    if (status === WhatsAppSessionStatus.DISCONNECTED || status === WhatsAppSessionStatus.FAILED) this.emitDisconnected(teamId, payload);
  }
}
