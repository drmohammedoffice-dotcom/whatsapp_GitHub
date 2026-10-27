-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('INBOX_READ', 'INBOX_WRITE', 'CONVERSATION_ASSIGN', 'CONVERSATION_CLOSE', 'CONTACT_READ', 'CONTACT_WRITE', 'AGENT_MANAGE', 'DEPARTMENT_MANAGE', 'ANALYTICS_READ', 'SETTINGS_MANAGE', 'API_KEY_MANAGE', 'WEBHOOK_MANAGE', 'AI_ACCESS', 'AI_MANAGE_KNOWLEDGE', 'AI_MANAGE_TOOLS', 'AI_VIEW_COSTS', 'TIKTOK_VIEW', 'TIKTOK_MANAGE');

-- CreateEnum
CREATE TYPE "WhatsAppSessionStatus" AS ENUM ('PENDING_QR', 'CONNECTING', 'CONNECTED', 'DISCONNECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "WhatsAppConnectionLogEvent" AS ENUM ('QR_GENERATED', 'QR_UPDATED', 'CONNECTING', 'CONNECTED', 'DISCONNECTED', 'RECONNECTING', 'SESSION_RESTORED', 'LOGGED_OUT', 'FAILED', 'MESSAGE_RECEIVED', 'PRESENCE_UPDATED', 'CONTACTS_UPDATED');

-- CreateEnum
CREATE TYPE "ChannelProvider" AS ENUM ('WHATSAPP_BAILEYS', 'META_MESSENGER', 'META_INSTAGRAM', 'TELEGRAM');

-- CreateEnum
CREATE TYPE "ChannelStatus" AS ENUM ('PENDING', 'CONNECTING', 'CONNECTED', 'DISCONNECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO', 'LOCATION', 'CONTACT', 'STICKER');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'RECEIVED');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'PENDING', 'CLOSED');

-- CreateEnum
CREATE TYPE "ConversationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ConversationEventType" AS ENUM ('CREATED', 'MESSAGE_CREATED', 'MESSAGE_STATUS_UPDATED', 'ASSIGNED', 'UNASSIGNED', 'STATUS_CHANGED', 'ARCHIVED', 'UNARCHIVED', 'PINNED', 'UNPINNED', 'TAGGED', 'UNTAGGED', 'NOTE_CREATED', 'COMMENT_CREATED', 'CONTACT_UPDATED', 'AI_REPLY_SENT', 'AI_TRANSFERRED', 'AI_PAUSED', 'AI_REACTIVATED', 'AUTOMATION_EXECUTED');

-- CreateEnum
CREATE TYPE "AgentPresence" AS ENUM ('OFFLINE', 'AVAILABLE', 'BUSY', 'AWAY');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ASSIGNMENT', 'MESSAGE', 'MENTION', 'SYSTEM', 'SLA');

-- CreateEnum
CREATE TYPE "WebhookEvent" AS ENUM ('INCOMING_MESSAGE', 'DELIVERY_STATUS', 'READ_STATUS', 'TYPING', 'PRESENCE', 'CONVERSATION_CREATED', 'CONVERSATION_UPDATED', 'CONVERSATION_ASSIGNED', 'CONVERSATION_MESSAGE_CREATED', 'CONTACT_UPDATED');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "AiDocumentStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "AiMemoryScope" AS ENUM ('CONVERSATION', 'CUSTOMER', 'BUSINESS', 'LONG_TERM');

-- CreateEnum
CREATE TYPE "AiToolKind" AS ENUM ('HTTP_REQUEST', 'CRM', 'CALENDAR', 'EMAIL', 'CUSTOM_API');

-- CreateEnum
CREATE TYPE "AiRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "AiAgentType" AS ENUM ('SUPERVISOR', 'SALES', 'SUPPORT', 'MARKETING', 'ADMIN');

-- CreateEnum
CREATE TYPE "ConversationAiMode" AS ENUM ('AI_ACTIVE', 'AI_PAUSED', 'HUMAN_ONLY');

-- CreateEnum
CREATE TYPE "AiTransferReason" AS ENUM ('CUSTOMER_REQUEST', 'LOW_CONFIDENCE', 'COMPLAINT', 'REFUND_REQUEST', 'SENSITIVE_ISSUE', 'CUSTOM_RULE', 'KNOWLEDGE_GAP');

-- CreateEnum
CREATE TYPE "AiProviderType" AS ENUM ('OPENAI_COMPATIBLE', 'OPENROUTER', 'GROQ', 'GEMINI', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AutomationTriggerType" AS ENUM ('CONVERSATION_OPENED', 'MESSAGE_RECEIVED', 'INACTIVITY', 'BUSINESS_HOURS', 'OUT_OF_OFFICE', 'ABANDONED_CART', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "AutomationActionType" AS ENUM ('SEND_GREETING', 'SEND_MESSAGE', 'SEND_FOLLOW_UP', 'SEND_REMINDER', 'AUTO_TAG', 'AUTO_ASSIGN', 'TRANSFER_TO_HUMAN');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'QUALIFIED', 'CONTACTED', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "SatisfactionSource" AS ENUM ('AI_CONVERSATION', 'HUMAN_CONVERSATION', 'SURVEY');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AiTrainingMediaType" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO');

-- CreateEnum
CREATE TYPE "TikTokConnectionStatus" AS ENUM ('DISCONNECTED', 'CONNECTING', 'CONNECTED', 'EXPIRED', 'ERROR');

-- CreateEnum
CREATE TYPE "TikTokEventType" AS ENUM ('PAGE_VISIT', 'CLICK', 'LANDING_PAGE', 'LEAD', 'CONVERSATION_STARTED', 'CONVERSATION_REPLIED', 'CONVERSATION_CLOSED', 'PURCHASE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TikTokLogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'MEMBER',
    "permissions" "Permission"[] DEFAULT ARRAY[]::"Permission"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replacedById" TEXT,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "provider" "ChannelProvider" NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ChannelStatus" NOT NULL DEFAULT 'PENDING',
    "externalId" TEXT,
    "whatsAppSessionId" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppSession" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "displayName" TEXT,
    "phoneNumber" TEXT,
    "jid" TEXT,
    "profilePhotoUrl" TEXT,
    "status" "WhatsAppSessionStatus" NOT NULL DEFAULT 'PENDING_QR',
    "qrCode" TEXT,
    "qrCodeUpdatedAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),
    "lastHeartbeatAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppConnectionLog" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "event" "WhatsAppConnectionLogEvent" NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppConnectionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppContact" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "providerContactId" TEXT NOT NULL,
    "displayName" TEXT,
    "phoneNumber" TEXT,
    "profilePhotoUrl" TEXT,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionCredential" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactIdentity" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactCustomField" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactCustomField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactCustomFieldValue" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactCustomFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Label" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Label_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactLabel" (
    "contactId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactLabel_pkey" PRIMARY KEY ("contactId","labelId")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentMember" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "teamMemberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepartmentMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentStatus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "presence" "AgentPresence" NOT NULL DEFAULT 'OFFLINE',
    "capacity" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "identityId" TEXT,
    "departmentId" TEXT,
    "assigneeUserId" TEXT,
    "subject" TEXT,
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "ConversationPriority" NOT NULL DEFAULT 'NORMAL',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "firstOpenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3),
    "lastReadAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "aiMode" "ConversationAiMode" NOT NULL DEFAULT 'AI_ACTIVE',
    "aiPausedAt" TIMESTAMP(3),
    "aiPausedByUserId" TEXT,
    "lastAiReplyAt" TIMESTAMP(3),
    "greetingSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMessage" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "sourceMessageId" TEXT,
    "providerMessageId" TEXT,
    "direction" "MessageDirection" NOT NULL,
    "type" "MessageType" NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'PENDING',
    "text" TEXT,
    "payload" JSONB,
    "mediaStorageKey" TEXT,
    "mediaMimeType" TEXT,
    "mediaFileName" TEXT,
    "mediaSizeBytes" INTEGER,
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationNote" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalComment" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationTag" (
    "conversationId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationTag_pkey" PRIMARY KEY ("conversationId","labelId")
);

-- CreateTable
CREATE TABLE "ConversationEvent" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "type" "ConversationEventType" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chat" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "providerChatId" TEXT NOT NULL,
    "name" TEXT,
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "fromJid" TEXT NOT NULL,
    "toJid" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "type" "MessageType" NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'PENDING',
    "text" TEXT,
    "payload" JSONB,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" "WebhookEvent"[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "event" "WebhookEvent" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsDailyMetric" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "metric" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "dimensions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsDailyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAgent" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AiAgentType" NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "model" TEXT,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiKnowledgeSource" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiKnowledgeSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiKnowledgeDocument" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "sourceId" TEXT,
    "title" TEXT NOT NULL,
    "mimeType" TEXT,
    "storageKey" TEXT,
    "url" TEXT,
    "status" "AiDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "checksum" TEXT,
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiKnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiKnowledgeChunk" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiKnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMemory" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "scope" "AiMemoryScope" NOT NULL,
    "userId" TEXT,
    "contactId" TEXT,
    "conversationId" TEXT,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "summary" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiTool" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "kind" "AiToolKind" NOT NULL,
    "schema" JSONB NOT NULL,
    "config" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiTool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiRun" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT,
    "agentId" TEXT,
    "conversationId" TEXT,
    "task" TEXT NOT NULL,
    "status" "AiRunStatus" NOT NULL DEFAULT 'PENDING',
    "input" JSONB NOT NULL,
    "output" JSONB,
    "error" TEXT,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCostEvent" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCostEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSettings" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "autoReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "confidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.65,
    "greetingMessage" TEXT,
    "outOfOfficeMessage" TEXT,
    "businessHours" JSONB,
    "holidayReplies" JSONB,
    "transferOnLowConfidence" BOOLEAN NOT NULL DEFAULT true,
    "transferOnComplaint" BOOLEAN NOT NULL DEFAULT true,
    "transferOnRefund" BOOLEAN NOT NULL DEFAULT true,
    "transferOnSensitive" BOOLEAN NOT NULL DEFAULT true,
    "transferOnHumanRequest" BOOLEAN NOT NULL DEFAULT true,
    "customTransferRules" JSONB,
    "pauseAiOnHumanReply" BOOLEAN NOT NULL DEFAULT true,
    "pauseAiOnAssignment" BOOLEAN NOT NULL DEFAULT true,
    "monthlyBudgetCents" INTEGER,
    "systemPromptOverride" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiProviderConfig" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "provider" "AiProviderType" NOT NULL DEFAULT 'OPENAI_COMPATIBLE',
    "encryptedApiKey" TEXT,
    "baseUrl" TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
    "model" TEXT,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "maxTokens" INTEGER NOT NULL DEFAULT 1024,
    "topP" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "enableStreaming" BOOLEAN NOT NULL DEFAULT false,
    "enableMemory" BOOLEAN NOT NULL DEFAULT true,
    "enableHumanHandover" BOOLEAN NOT NULL DEFAULT true,
    "enableVision" BOOLEAN NOT NULL DEFAULT false,
    "enableProductSearch" BOOLEAN NOT NULL DEFAULT true,
    "enableImageSending" BOOLEAN NOT NULL DEFAULT false,
    "lastTestAt" TIMESTAMP(3),
    "lastTestOk" BOOLEAN,
    "lastTestMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationTransfer" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "reason" "AiTransferReason" NOT NULL,
    "summary" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "fromAiRunId" TEXT,
    "assignedUserId" TEXT,
    "initiatedByUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "trigger" "AutomationTriggerType" NOT NULL,
    "action" "AutomationActionType" NOT NULL,
    "conditions" JSONB,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "category" TEXT,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT,
    "altText" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiTrainingMedia" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "productName" TEXT,
    "description" TEXT,
    "mediaType" "AiTrainingMediaType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileName" TEXT,
    "sizeBytes" INTEGER,
    "tags" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiTrainingMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "conversationId" TEXT,
    "contactId" TEXT,
    "orderNumber" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "orderType" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IQD',
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "usedWhatsappPhone" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "contactId" TEXT,
    "conversationId" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "score" DOUBLE PRECISION,
    "source" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerSatisfaction" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "conversationId" TEXT,
    "contactId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "source" "SatisfactionSource" NOT NULL DEFAULT 'AI_CONVERSATION',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerSatisfaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TikTokAccount" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "status" "TikTokConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "businessName" TEXT,
    "openId" TEXT,
    "advertiserId" TEXT,
    "businessCenterId" TEXT,
    "connectedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TikTokAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TikTokToken" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TikTokToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TikTokAdvertiser" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "name" TEXT,
    "currency" TEXT,
    "timezone" TEXT,
    "status" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TikTokAdvertiser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TikTokBusinessCenter" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "businessCenterId" TEXT NOT NULL,
    "name" TEXT,
    "currency" TEXT,
    "timezone" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TikTokBusinessCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TikTokSettings" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "eventsApiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoSyncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "syncIntervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "defaultWhatsAppNumber" TEXT,
    "trackingRedirectMessage" TEXT,
    "partnerMessagingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "partnerEventsApiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TikTokSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TikTokEvent" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "accountId" TEXT,
    "eventType" "TikTokEventType" NOT NULL,
    "campaignId" TEXT,
    "adGroupId" TEXT,
    "adId" TEXT,
    "clickId" TEXT,
    "customerId" TEXT,
    "conversationId" TEXT,
    "contactId" TEXT,
    "customName" TEXT,
    "payload" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TikTokEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TikTokLog" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "accountId" TEXT,
    "level" "TikTokLogLevel" NOT NULL DEFAULT 'INFO',
    "action" TEXT NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TikTokLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TikTokCampaign" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "accountId" TEXT,
    "name" TEXT NOT NULL,
    "externalCampaignId" TEXT,
    "adGroupId" TEXT,
    "adId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "whatsappNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TikTokCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TikTokTrackingClick" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "clickToken" TEXT NOT NULL,
    "ttclid" TEXT,
    "source" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "referrer" TEXT,
    "landingUrl" TEXT,
    "conversationId" TEXT,
    "contactId" TEXT,
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TikTokTrackingClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Team_slug_key" ON "Team"("slug");

-- CreateIndex
CREATE INDEX "TeamMember_userId_idx" ON "TeamMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_whatsAppSessionId_key" ON "Channel"("whatsAppSessionId");

-- CreateIndex
CREATE INDEX "Channel_teamId_status_idx" ON "Channel"("teamId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_teamId_provider_externalId_key" ON "Channel"("teamId", "provider", "externalId");

-- CreateIndex
CREATE INDEX "WhatsAppSession_teamId_status_idx" ON "WhatsAppSession"("teamId", "status");

-- CreateIndex
CREATE INDEX "WhatsAppSession_teamId_createdByUserId_idx" ON "WhatsAppSession"("teamId", "createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppSession_teamId_phoneNumber_key" ON "WhatsAppSession"("teamId", "phoneNumber");

-- CreateIndex
CREATE INDEX "WhatsAppConnectionLog_sessionId_createdAt_idx" ON "WhatsAppConnectionLog"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppConnectionLog_teamId_createdAt_idx" ON "WhatsAppConnectionLog"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppContact_teamId_sessionId_idx" ON "WhatsAppContact"("teamId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppContact_sessionId_providerContactId_key" ON "WhatsAppContact"("sessionId", "providerContactId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionCredential_sessionId_key_key" ON "SessionCredential"("sessionId", "key");

-- CreateIndex
CREATE INDEX "Contact_teamId_displayName_idx" ON "Contact"("teamId", "displayName");

-- CreateIndex
CREATE INDEX "Contact_teamId_phone_idx" ON "Contact"("teamId", "phone");

-- CreateIndex
CREATE INDEX "Contact_teamId_email_idx" ON "Contact"("teamId", "email");

-- CreateIndex
CREATE INDEX "ContactIdentity_teamId_contactId_idx" ON "ContactIdentity"("teamId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactIdentity_channelId_externalId_key" ON "ContactIdentity"("channelId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactCustomField_teamId_key_key" ON "ContactCustomField"("teamId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ContactCustomFieldValue_contactId_fieldId_key" ON "ContactCustomFieldValue"("contactId", "fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "Label_teamId_name_key" ON "Label"("teamId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_teamId_name_key" ON "Department"("teamId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentMember_departmentId_teamMemberId_key" ON "DepartmentMember"("departmentId", "teamMemberId");

-- CreateIndex
CREATE INDEX "AgentStatus_teamId_presence_idx" ON "AgentStatus"("teamId", "presence");

-- CreateIndex
CREATE UNIQUE INDEX "AgentStatus_teamId_userId_key" ON "AgentStatus"("teamId", "userId");

-- CreateIndex
CREATE INDEX "Conversation_teamId_status_isArchived_lastMessageAt_idx" ON "Conversation"("teamId", "status", "isArchived", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_teamId_assigneeUserId_status_idx" ON "Conversation"("teamId", "assigneeUserId", "status");

-- CreateIndex
CREATE INDEX "Conversation_teamId_aiMode_idx" ON "Conversation"("teamId", "aiMode");

-- CreateIndex
CREATE INDEX "Conversation_contactId_idx" ON "Conversation"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationMessage_sourceMessageId_key" ON "ConversationMessage"("sourceMessageId");

-- CreateIndex
CREATE INDEX "ConversationMessage_teamId_createdAt_idx" ON "ConversationMessage"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "ConversationMessage_conversationId_createdAt_idx" ON "ConversationMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationMessage_conversationId_providerMessageId_key" ON "ConversationMessage"("conversationId", "providerMessageId");

-- CreateIndex
CREATE INDEX "ConversationNote_conversationId_createdAt_idx" ON "ConversationNote"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "InternalComment_conversationId_createdAt_idx" ON "InternalComment"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ConversationEvent_conversationId_createdAt_idx" ON "ConversationEvent"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Chat_teamId_lastMessageAt_idx" ON "Chat"("teamId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "Chat_sessionId_providerChatId_key" ON "Chat"("sessionId", "providerChatId");

-- CreateIndex
CREATE INDEX "Message_teamId_createdAt_idx" ON "Message"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_chatId_createdAt_idx" ON "Message"("chatId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_sessionId_providerMessageId_key" ON "Message"("sessionId", "providerMessageId");

-- CreateIndex
CREATE INDEX "Attachment_messageId_idx" ON "Attachment"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_teamId_idx" ON "ApiKey"("teamId");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_teamId_enabled_idx" ON "WebhookEndpoint"("teamId", "enabled");

-- CreateIndex
CREATE INDEX "WebhookDelivery_webhookId_status_idx" ON "WebhookDelivery"("webhookId", "status");

-- CreateIndex
CREATE INDEX "Notification_teamId_userId_readAt_createdAt_idx" ON "Notification"("teamId", "userId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_teamId_userId_channel_key" ON "NotificationPreference"("teamId", "userId", "channel");

-- CreateIndex
CREATE INDEX "AnalyticsDailyMetric_teamId_day_idx" ON "AnalyticsDailyMetric"("teamId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsDailyMetric_teamId_day_metric_key" ON "AnalyticsDailyMetric"("teamId", "day", "metric");

-- CreateIndex
CREATE INDEX "AiAgent_teamId_enabled_idx" ON "AiAgent"("teamId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "AiAgent_teamId_type_key" ON "AiAgent"("teamId", "type");

-- CreateIndex
CREATE INDEX "AiKnowledgeSource_teamId_type_idx" ON "AiKnowledgeSource"("teamId", "type");

-- CreateIndex
CREATE INDEX "AiKnowledgeDocument_teamId_status_idx" ON "AiKnowledgeDocument"("teamId", "status");

-- CreateIndex
CREATE INDEX "AiKnowledgeChunk_teamId_documentId_idx" ON "AiKnowledgeChunk"("teamId", "documentId");

-- CreateIndex
CREATE INDEX "AiMemory_teamId_scope_key_idx" ON "AiMemory"("teamId", "scope", "key");

-- CreateIndex
CREATE INDEX "AiMemory_teamId_contactId_idx" ON "AiMemory"("teamId", "contactId");

-- CreateIndex
CREATE INDEX "AiMemory_teamId_conversationId_idx" ON "AiMemory"("teamId", "conversationId");

-- CreateIndex
CREATE INDEX "AiTool_teamId_enabled_idx" ON "AiTool"("teamId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "AiTool_teamId_name_key" ON "AiTool"("teamId", "name");

-- CreateIndex
CREATE INDEX "AiRun_teamId_createdAt_idx" ON "AiRun"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "AiRun_teamId_status_idx" ON "AiRun"("teamId", "status");

-- CreateIndex
CREATE INDEX "AiCostEvent_teamId_createdAt_idx" ON "AiCostEvent"("teamId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_teamId_key_key" ON "Setting"("teamId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "AiSettings_teamId_key" ON "AiSettings"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "AiProviderConfig_teamId_key" ON "AiProviderConfig"("teamId");

-- CreateIndex
CREATE INDEX "ConversationTransfer_teamId_createdAt_idx" ON "ConversationTransfer"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "ConversationTransfer_conversationId_createdAt_idx" ON "ConversationTransfer"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "AutomationRule_teamId_enabled_priority_idx" ON "AutomationRule"("teamId", "enabled", "priority");

-- CreateIndex
CREATE INDEX "Product_teamId_isActive_idx" ON "Product"("teamId", "isActive");

-- CreateIndex
CREATE INDEX "Product_teamId_name_idx" ON "Product"("teamId", "name");

-- CreateIndex
CREATE INDEX "ProductImage_productId_position_idx" ON "ProductImage"("productId", "position");

-- CreateIndex
CREATE INDEX "AiTrainingMedia_teamId_createdAt_idx" ON "AiTrainingMedia"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "AiTrainingMedia_teamId_productName_idx" ON "AiTrainingMedia"("teamId", "productName");

-- CreateIndex
CREATE INDEX "Booking_teamId_createdAt_idx" ON "Booking"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_conversationId_idx" ON "Booking"("conversationId");

-- CreateIndex
CREATE INDEX "Booking_contactId_idx" ON "Booking"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_teamId_orderNumber_key" ON "Booking"("teamId", "orderNumber");

-- CreateIndex
CREATE INDEX "Lead_teamId_status_createdAt_idx" ON "Lead"("teamId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_conversationId_idx" ON "Lead"("conversationId");

-- CreateIndex
CREATE INDEX "CustomerSatisfaction_teamId_createdAt_idx" ON "CustomerSatisfaction"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerSatisfaction_conversationId_idx" ON "CustomerSatisfaction"("conversationId");

-- CreateIndex
CREATE INDEX "AuditLog_teamId_createdAt_idx" ON "AuditLog"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TikTokAccount_teamId_key" ON "TikTokAccount"("teamId");

-- CreateIndex
CREATE INDEX "TikTokAccount_status_idx" ON "TikTokAccount"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TikTokToken_accountId_key" ON "TikTokToken"("accountId");

-- CreateIndex
CREATE INDEX "TikTokAdvertiser_teamId_idx" ON "TikTokAdvertiser"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TikTokAdvertiser_accountId_advertiserId_key" ON "TikTokAdvertiser"("accountId", "advertiserId");

-- CreateIndex
CREATE INDEX "TikTokBusinessCenter_teamId_idx" ON "TikTokBusinessCenter"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TikTokBusinessCenter_accountId_businessCenterId_key" ON "TikTokBusinessCenter"("accountId", "businessCenterId");

-- CreateIndex
CREATE UNIQUE INDEX "TikTokSettings_teamId_key" ON "TikTokSettings"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TikTokSettings_accountId_key" ON "TikTokSettings"("accountId");

-- CreateIndex
CREATE INDEX "TikTokEvent_teamId_eventType_occurredAt_idx" ON "TikTokEvent"("teamId", "eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "TikTokEvent_campaignId_idx" ON "TikTokEvent"("campaignId");

-- CreateIndex
CREATE INDEX "TikTokEvent_conversationId_idx" ON "TikTokEvent"("conversationId");

-- CreateIndex
CREATE INDEX "TikTokEvent_clickId_idx" ON "TikTokEvent"("clickId");

-- CreateIndex
CREATE INDEX "TikTokLog_teamId_createdAt_idx" ON "TikTokLog"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "TikTokLog_accountId_idx" ON "TikTokLog"("accountId");

-- CreateIndex
CREATE INDEX "TikTokCampaign_teamId_active_idx" ON "TikTokCampaign"("teamId", "active");

-- CreateIndex
CREATE INDEX "TikTokCampaign_accountId_idx" ON "TikTokCampaign"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "TikTokTrackingClick_clickToken_key" ON "TikTokTrackingClick"("clickToken");

-- CreateIndex
CREATE INDEX "TikTokTrackingClick_teamId_createdAt_idx" ON "TikTokTrackingClick"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "TikTokTrackingClick_campaignId_idx" ON "TikTokTrackingClick"("campaignId");

-- CreateIndex
CREATE INDEX "TikTokTrackingClick_clickToken_idx" ON "TikTokTrackingClick"("clickToken");

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_whatsAppSessionId_fkey" FOREIGN KEY ("whatsAppSessionId") REFERENCES "WhatsAppSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppSession" ADD CONSTRAINT "WhatsAppSession_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppSession" ADD CONSTRAINT "WhatsAppSession_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppConnectionLog" ADD CONSTRAINT "WhatsAppConnectionLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WhatsAppSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppContact" ADD CONSTRAINT "WhatsAppContact_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WhatsAppSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionCredential" ADD CONSTRAINT "SessionCredential_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WhatsAppSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactIdentity" ADD CONSTRAINT "ContactIdentity_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactIdentity" ADD CONSTRAINT "ContactIdentity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactIdentity" ADD CONSTRAINT "ContactIdentity_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactCustomField" ADD CONSTRAINT "ContactCustomField_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactCustomFieldValue" ADD CONSTRAINT "ContactCustomFieldValue_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactCustomFieldValue" ADD CONSTRAINT "ContactCustomFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "ContactCustomField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Label" ADD CONSTRAINT "Label_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactLabel" ADD CONSTRAINT "ContactLabel_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactLabel" ADD CONSTRAINT "ContactLabel_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "Label"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentMember" ADD CONSTRAINT "DepartmentMember_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentMember" ADD CONSTRAINT "DepartmentMember_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentStatus" ADD CONSTRAINT "AgentStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "ContactIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationNote" ADD CONSTRAINT "ConversationNote_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationNote" ADD CONSTRAINT "ConversationNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalComment" ADD CONSTRAINT "InternalComment_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalComment" ADD CONSTRAINT "InternalComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationTag" ADD CONSTRAINT "ConversationTag_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationTag" ADD CONSTRAINT "ConversationTag_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "Label"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationEvent" ADD CONSTRAINT "ConversationEvent_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WhatsAppSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WhatsAppSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsDailyMetric" ADD CONSTRAINT "AnalyticsDailyMetric_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAgent" ADD CONSTRAINT "AiAgent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiKnowledgeSource" ADD CONSTRAINT "AiKnowledgeSource_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiKnowledgeDocument" ADD CONSTRAINT "AiKnowledgeDocument_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiKnowledgeDocument" ADD CONSTRAINT "AiKnowledgeDocument_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AiKnowledgeSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiKnowledgeChunk" ADD CONSTRAINT "AiKnowledgeChunk_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiKnowledgeChunk" ADD CONSTRAINT "AiKnowledgeChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "AiKnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiMemory" ADD CONSTRAINT "AiMemory_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiMemory" ADD CONSTRAINT "AiMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTool" ADD CONSTRAINT "AiTool_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AiAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCostEvent" ADD CONSTRAINT "AiCostEvent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSettings" ADD CONSTRAINT "AiSettings_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiProviderConfig" ADD CONSTRAINT "AiProviderConfig_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationTransfer" ADD CONSTRAINT "ConversationTransfer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationTransfer" ADD CONSTRAINT "ConversationTransfer_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationTransfer" ADD CONSTRAINT "ConversationTransfer_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationTransfer" ADD CONSTRAINT "ConversationTransfer_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTrainingMedia" ADD CONSTRAINT "AiTrainingMedia_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSatisfaction" ADD CONSTRAINT "CustomerSatisfaction_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSatisfaction" ADD CONSTRAINT "CustomerSatisfaction_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSatisfaction" ADD CONSTRAINT "CustomerSatisfaction_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokAccount" ADD CONSTRAINT "TikTokAccount_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokToken" ADD CONSTRAINT "TikTokToken_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TikTokAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokAdvertiser" ADD CONSTRAINT "TikTokAdvertiser_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TikTokAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokBusinessCenter" ADD CONSTRAINT "TikTokBusinessCenter_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TikTokAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokSettings" ADD CONSTRAINT "TikTokSettings_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TikTokAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokSettings" ADD CONSTRAINT "TikTokSettings_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokEvent" ADD CONSTRAINT "TikTokEvent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokEvent" ADD CONSTRAINT "TikTokEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TikTokAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokEvent" ADD CONSTRAINT "TikTokEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "TikTokCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokEvent" ADD CONSTRAINT "TikTokEvent_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokEvent" ADD CONSTRAINT "TikTokEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokLog" ADD CONSTRAINT "TikTokLog_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokLog" ADD CONSTRAINT "TikTokLog_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TikTokAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokCampaign" ADD CONSTRAINT "TikTokCampaign_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokCampaign" ADD CONSTRAINT "TikTokCampaign_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TikTokAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokTrackingClick" ADD CONSTRAINT "TikTokTrackingClick_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokTrackingClick" ADD CONSTRAINT "TikTokTrackingClick_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "TikTokCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokTrackingClick" ADD CONSTRAINT "TikTokTrackingClick_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokTrackingClick" ADD CONSTRAINT "TikTokTrackingClick_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

