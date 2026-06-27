export const SOCKET_EVENTS = {
  // WhatsApp connection (production)
  QR_GENERATED: 'qr.generated',
  QR_UPDATED: 'qr.updated',
  WHATSAPP_CONNECTED: 'connected',
  WHATSAPP_DISCONNECTED: 'disconnected',
  WHATSAPP_RECONNECTING: 'reconnecting',
  SESSION_RESTORED: 'session.restored',
  MESSAGE_RECEIVED: 'message.received',
  STATUS_CHANGED: 'status.changed',
  // Legacy aliases (backward compatible)
  QR_UPDATED_LEGACY: 'whatsapp.qr.updated',
  SESSION_STATUS_UPDATED: 'whatsapp.session.status.updated',
  CONVERSATION_CREATED: 'conversation.created',
  CONVERSATION_UPDATED: 'conversation.updated',
  CONVERSATION_ASSIGNED: 'conversation.assigned',
  CONVERSATION_ARCHIVED: 'conversation.archived',
  CONVERSATION_PINNED: 'conversation.pinned',
  CONVERSATION_MESSAGE_CREATED: 'conversation.message.created',
  CONVERSATION_MESSAGE_STATUS_UPDATED: 'conversation.message.status.updated',
  CONVERSATION_NOTE_CREATED: 'conversation.note.created',
  CONVERSATION_COMMENT_CREATED: 'conversation.comment.created',
  CONTACT_UPDATED: 'contact.updated',
  TAG_UPDATED: 'tag.updated',
  AGENT_STATUS_UPDATED: 'agent.status.updated',
  NOTIFICATION_CREATED: 'notification.created',
  WEBHOOK_DELIVERY_UPDATED: 'webhook.delivery.updated',
  AI_RUN_UPDATED: 'ai.run.updated',
  AI_KNOWLEDGE_INDEXED: 'ai.knowledge.indexed',
  AI_COST_UPDATED: 'ai.cost.updated',
  AI_REPLY_SENT: 'ai.reply.sent',
  AI_TRANSFERRED: 'ai.transferred',
  AI_PAUSED: 'ai.paused',
  AI_REACTIVATED: 'ai.reactivated',
} as const;

export const WEBHOOK_EVENTS = {
  INCOMING_MESSAGE: 'incoming.message',
  DELIVERY_STATUS: 'delivery.status',
  READ_STATUS: 'read.status',
  TYPING: 'typing',
  PRESENCE: 'presence',
  CONVERSATION_CREATED: 'conversation.created',
  CONVERSATION_UPDATED: 'conversation.updated',
  CONVERSATION_ASSIGNED: 'conversation.assigned',
  CONVERSATION_MESSAGE_CREATED: 'conversation.message.created',
  CONTACT_UPDATED: 'contact.updated',
} as const;

export const API_KEY_PREFIX = 'wsp_live';

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
export type WebhookEventName = (typeof WEBHOOK_EVENTS)[keyof typeof WEBHOOK_EVENTS];

export type SessionStatus = 'PENDING_QR' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'FAILED';
export type ChannelProvider = 'WHATSAPP_BAILEYS' | 'META_MESSENGER' | 'META_INSTAGRAM' | 'TELEGRAM';
export type ChannelStatus = 'PENDING' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'FAILED';
export type ConversationStatus = 'OPEN' | 'PENDING' | 'CLOSED';
export type MessageDirection = 'INBOUND' | 'OUTBOUND';
export type MessageKind = 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'VIDEO' | 'LOCATION' | 'CONTACT';
export type AgentPresence = 'OFFLINE' | 'AVAILABLE' | 'BUSY' | 'AWAY';

export interface ApiEnvelope<T> {
  data: T;
  requestId?: string;
}

export interface WebhookPayload<T = unknown> {
  id: string;
  event: WebhookEventName;
  teamId: string;
  occurredAt: string;
  data: T;
}

export interface ConversationRealtimePayload {
  id: string;
  teamId: string;
  contactId: string;
  status: ConversationStatus;
  assigneeUserId?: string | null;
}


export const AI_TASKS = {
  CHAT: 'chat',
  SUGGEST_REPLY: 'suggest_reply',
  AUTO_REPLY: 'auto_reply',
  REWRITE: 'rewrite',
  TRANSLATE: 'translate',
  SUMMARIZE: 'summarize',
  SENTIMENT: 'sentiment',
  INTENT: 'intent',
  SPAM: 'spam',
  LEAD_QUALIFICATION: 'lead_qualification',
  CLASSIFICATION: 'classification',
  SMART_ROUTING: 'smart_routing',
  AI_SEARCH: 'ai_search',
} as const;

export type AiTaskName = (typeof AI_TASKS)[keyof typeof AI_TASKS];
export type AiAgentType = 'SUPERVISOR' | 'SALES' | 'SUPPORT' | 'MARKETING' | 'ADMIN';
export type AiMemoryScope = 'CONVERSATION' | 'CUSTOMER' | 'BUSINESS' | 'LONG_TERM';

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
}
