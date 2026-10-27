import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WebSocketGateway, WebSocketServer, OnGatewayConnection, SubscribeMessage, ConnectedSocket, MessageBody } from '@nestjs/websockets';
import { SOCKET_EVENTS } from '@watsapp/shared';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

interface SocketPrincipal { userId: string; teamId: string }
interface JwtPayload { sub: string; teamId: string }

declare module 'socket.io' {
  interface Socket { principal?: SocketPrincipal }
}

function allowedSocketOrigins() {
  return (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      callback(null, allowedSocketOrigins().includes(origin));
    },
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    const allowed = allowedSocketOrigins();
    const origin = String(client.handshake.headers.origin ?? '');
    if (origin && !allowed.includes(origin)) {
      return client.disconnect(true);
    }
    const token = client.handshake.auth?.token || client.handshake.headers.authorization?.toString().replace('Bearer ', '');
    if (!token) return client.disconnect(true);
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET') });
      const membership = await this.prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId: payload.teamId, userId: payload.sub } },
      });
      if (!membership) return client.disconnect(true);
      client.principal = { userId: payload.sub, teamId: payload.teamId };
      await client.join(`team:${payload.teamId}`);
      await client.join(`user:${payload.sub}`);
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('conversation.join')
  async joinConversation(@ConnectedSocket() client: Socket, @MessageBody() body: { conversationId: string }) {
    if (!client.principal || !body?.conversationId) return;
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: body.conversationId, teamId: client.principal.teamId },
      select: { id: true },
    });
    if (!conversation) return;
    await client.join(`conversation:${conversation.id}`);
  }

  emitQr(teamId: string, sessionId: string, qrCode: string) {
    this.server.to(`team:${teamId}`).emit(SOCKET_EVENTS.QR_UPDATED, { sessionId, qrCode });
  }

  emitStatus(teamId: string, sessionId: string, status: string) {
    this.server.to(`team:${teamId}`).emit(SOCKET_EVENTS.SESSION_STATUS_UPDATED, { sessionId, status });
  }

  emitTeam(teamId: string, event: string, payload: unknown) {
    this.server.to(`team:${teamId}`).emit(event, payload);
  }

  emitUser(userId: string, event: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  emitConversation(conversationId: string, event: string, payload: unknown) {
    this.server.to(`conversation:${conversationId}`).emit(event, payload);
  }
}
