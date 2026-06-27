import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { BaileysSocket, SessionContext } from './interfaces/session.interface';
import { reconnectDelayMs } from './utils/disconnect.util';

type ReconnectHandler = (context: SessionContext) => Promise<void>;

@Injectable()
export class SessionManager implements OnModuleDestroy {
  private readonly logger = new Logger(SessionManager.name);
  private readonly sockets = new Map<string, BaileysSocket>();
  private readonly reconnectTimers = new Map<string, NodeJS.Timeout>();
  private readonly reconnectAttempts = new Map<string, number>();
  private readonly heartbeatTimers = new Map<string, NodeJS.Timeout>();
  private reconnectHandler?: ReconnectHandler;
  private heartbeatHandler?: (context: SessionContext) => Promise<void>;

  onModuleDestroy() {
    for (const timer of this.reconnectTimers.values()) clearTimeout(timer);
    for (const timer of this.heartbeatTimers.values()) clearTimeout(timer);
    for (const [sessionId, socket] of this.sockets.entries()) {
      try {
        socket.end?.();
      } catch (error) {
        this.logger.warn(`Failed to close socket ${sessionId}: ${String(error)}`);
      }
    }
    this.sockets.clear();
  }

  setReconnectHandler(handler: ReconnectHandler) {
    this.reconnectHandler = handler;
  }

  setHeartbeatHandler(handler: (context: SessionContext) => Promise<void>) {
    this.heartbeatHandler = handler;
  }

  getSocket(sessionId: string) {
    return this.sockets.get(sessionId);
  }

  setSocket(sessionId: string, socket: BaileysSocket) {
    this.sockets.set(sessionId, socket);
  }

  removeSocket(sessionId: string) {
    this.sockets.delete(sessionId);
    this.clearHeartbeat(sessionId);
  }

  hasSocket(sessionId: string) {
    return this.sockets.has(sessionId);
  }

  clearReconnect(sessionId: string) {
    const timer = this.reconnectTimers.get(sessionId);
    if (timer) clearTimeout(timer);
    this.reconnectTimers.delete(sessionId);
    this.reconnectAttempts.delete(sessionId);
  }

  scheduleReconnect(context: SessionContext) {
    const attempt = (this.reconnectAttempts.get(context.sessionId) ?? 0) + 1;
    if (attempt > 12) {
      this.logger.error(`Max reconnect attempts reached for session ${context.sessionId}`);
      return;
    }
    this.reconnectAttempts.set(context.sessionId, attempt);
    const delay = reconnectDelayMs(attempt);
    this.logger.log(`Scheduling reconnect for ${context.sessionId} in ${delay}ms (attempt ${attempt})`);
    const timer = setTimeout(async () => {
      this.reconnectTimers.delete(context.sessionId);
      if (this.reconnectHandler) await this.reconnectHandler(context);
    }, delay);
    this.reconnectTimers.set(context.sessionId, timer);
  }

  startHeartbeat(context: SessionContext) {
    this.clearHeartbeat(context.sessionId);
    const tick = async () => {
      if (!this.sockets.has(context.sessionId)) return;
      if (this.heartbeatHandler) await this.heartbeatHandler(context);
      const timer = setTimeout(tick, 30_000);
      this.heartbeatTimers.set(context.sessionId, timer);
    };
    const timer = setTimeout(tick, 30_000);
    this.heartbeatTimers.set(context.sessionId, timer);
  }

  clearHeartbeat(sessionId: string) {
    const timer = this.heartbeatTimers.get(sessionId);
    if (timer) clearTimeout(timer);
    this.heartbeatTimers.delete(sessionId);
  }
}
