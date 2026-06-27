import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { getAccessToken, SOCKET_URL } from './utils';

export function createSocket(): Socket {
  return io(SOCKET_URL, { transports: ['websocket'], auth: { token: getAccessToken() } });
}
