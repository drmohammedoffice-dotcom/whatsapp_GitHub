import { WhatsAppSessionStatus } from '@watsapp/database';

export interface BaileysSocket {
  ev: { on: (event: string, listener: (...args: any[]) => void) => void; off?: (event: string, listener: (...args: any[]) => void) => void };
  user?: { id?: string; name?: string };
  sendMessage: (jid: string, content: any) => Promise<any>;
  profilePictureUrl?: (jid: string) => Promise<string | undefined>;
  logout?: () => Promise<void>;
  end?: (error?: Error) => void;
}

export interface SessionContext {
  teamId: string;
  sessionId: string;
  userId?: string;
}

export interface DisconnectInfo {
  code?: number;
  message: string;
  shouldReconnect: boolean;
  isLoggedOut: boolean;
}

export interface SessionProfile {
  sessionId: string;
  displayName: string | null;
  phoneNumber: string | null;
  jid: string | null;
  profilePhotoUrl: string | null;
  status: WhatsAppSessionStatus;
  connectedAt: Date | null;
  lastSeenAt: Date | null;
}

export interface QrPayload {
  sessionId: string;
  qrCode: string;
  expiresAt?: string;
}

export interface StatusPayload {
  sessionId: string;
  status: WhatsAppSessionStatus;
  failureReason?: string | null;
}

export interface ISessionManager {
  getSocket(sessionId: string): BaileysSocket | undefined;
  setSocket(sessionId: string, socket: BaileysSocket): void;
  removeSocket(sessionId: string): void;
  hasSocket(sessionId: string): boolean;
  scheduleReconnect(context: SessionContext, attempt: number): void;
  clearReconnect(sessionId: string): void;
}

export interface IWhatsAppRepository {
  findSessionForTeam(teamId: string, sessionId: string): Promise<{ id: string; teamId: string; status: WhatsAppSessionStatus } | null>;
  listSessions(teamId: string, userId?: string): Promise<unknown[]>;
}
