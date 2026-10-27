-- Baseline: full ChatLoora schema as of 2026-10-27 (replaces the 60 archived migrations).
-- Fresh databases are built from this file. Existing production databases mark it as
-- already applied (see deploy/coolify/README.md, "Migration baseline").

CREATE EXTENSION IF NOT EXISTS vector;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('INBOX_READ', 'INBOX_WRITE', 'CONVERSATION_ASSIGN', 'CONVERSATION_CLOSE', 'CONTACT_READ', 'CONTACT_WRITE', 'AGENT_MANAGE', 'DEPARTMENT_MANAGE', 'ANALYTICS_READ', 'SETTINGS_MANAGE', 'API_KEY_MANAGE', 'WEBHOOK_MANAGE', 'AI_ACCESS', 'AI_MANAGE_KNOWLEDGE', 'AI_MANAGE_TOOLS', 'AI_VIEW_COSTS', 'TIKTOK_VIEW', 'TIKTOK_MANAGE', 'BUSINESS_MANAGE', 'CAMPAIGN_MANAGE', 'WHATSAPP_CLOUD_MANAGE', 'ROUTING_MANAGE', 'APPOINTMENT_READ', 'APPOINTMENT_MANAGE', 'APPOINTMENT_CALENDAR', 'APPOINTMENT_REMINDERS');

-- CreateEnum
CREATE TYPE "WhatsAppSessionStatus" AS ENUM ('PENDING_QR', 'CONNECTING', 'CONNECTED', 'DISCONNECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "WhatsAppConnectionLogEvent" AS ENUM ('QR_GENERATED', 'QR_UPDATED', 'CONNECTING', 'CONNECTED', 'DISCONNECTED', 'RECONNECTING', 'SESSION_RESTORED', 'LOGGED_OUT', 'FAILED', 'MESSAGE_RECEIVED', 'PRESENCE_UPDATED', 'CONTACTS_UPDATED');

-- CreateEnum
CREATE TYPE "ChannelProvider" AS ENUM ('WHATSAPP_BAILEYS', 'WHATSAPP_CLOUD', 'META_MESSENGER', 'META_INSTAGRAM', 'TELEGRAM', 'TELEGRAM_USER');

-- CreateEnum
CREATE TYPE "CampaignSourceType" AS ENUM ('TIKTOK', 'FACEBOOK', 'INSTAGRAM', 'GOOGLE', 'LANDING_PAGE', 'SNAPCHAT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "WhatsAppRoutingStrategy" AS ENUM ('MANUAL', 'ROUND_ROBIN', 'RANDOM', 'PERCENTAGE', 'COUNTRY', 'CAMPAIGN', 'AI');

-- CreateEnum
CREATE TYPE "WhatsAppCloudAccountStatus" AS ENUM ('PENDING', 'CONNECTING', 'CONNECTED', 'DISCONNECTED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "WebhookProvider" AS ENUM ('TIKTOK', 'META', 'WHATSAPP_CLOUD', 'GOOGLE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "TelegramConnectionStatus" AS ENUM ('PENDING_CODE', 'PENDING_PASSWORD', 'CONNECTING', 'CONNECTED', 'DISCONNECTED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "ChannelStatus" AS ENUM ('PENDING', 'CONNECTING', 'CONNECTED', 'DISCONNECTED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ChannelPurpose" AS ENUM ('INBOX', 'TRACKING');

-- CreateEnum
CREATE TYPE "OAuthSessionStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED', 'FAILED');

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
CREATE TYPE "ConversationKind" AS ENUM ('DIRECT_MESSAGE', 'COMMENT');

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
CREATE TYPE "EmailVerificationType" AS ENUM ('SIGNUP', 'LOGIN');

-- CreateEnum
CREATE TYPE "ProductMediaKind" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AiTrainingPlatform" AS ENUM ('WHATSAPP', 'TELEGRAM', 'MESSENGER', 'INSTAGRAM', 'TIKTOK', 'META');

-- CreateEnum
CREATE TYPE "AiTrainingMediaType" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO');

-- CreateEnum
CREATE TYPE "TikTokConnectionStatus" AS ENUM ('DISCONNECTED', 'CONNECTING', 'CONNECTED', 'EXPIRED', 'ERROR');

-- CreateEnum
CREATE TYPE "TikTokEventType" AS ENUM ('PAGE_VISIT', 'CLICK', 'LANDING_PAGE', 'LEAD', 'CONVERSATION_STARTED', 'CONVERSATION_REPLIED', 'CONVERSATION_CLOSED', 'PURCHASE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TikTokLogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "TikTokAdsBalanceCheckoutStatus" AS ENUM ('INITIATED', 'REDIRECTED', 'PENDING_CONFIRMATION', 'EXTERNAL_CHECKOUT', 'CONFIRMED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TikTokOptimizationEvent" AS ENUM ('PageView', 'ViewContent', 'Lead', 'CompleteRegistration', 'Contact', 'SubmitForm', 'AddToCart', 'InitiateCheckout', 'Purchase', 'CompletePayment', 'Custom');

-- CreateEnum
CREATE TYPE "AdminNotificationChannel" AS ENUM ('EMAIL', 'IN_APP', 'BROADCAST');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'SUPPORT_AGENT', 'BILLING_MANAGER', 'DEVELOPER', 'STAFF', 'ACCOUNTANT', 'MAILBOX_CREATOR');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PlatformActivityCategory" AS ENUM ('AUTH', 'SUBSCRIPTION', 'USER', 'INTEGRATION', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED', 'PENDING');

-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'PENDING', 'CLOSED');

-- CreateEnum
CREATE TYPE "AppointmentVertical" AS ENUM ('GENERIC', 'CLINIC', 'SALON', 'WORKSHOP', 'OFFICE');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "AppointmentSource" AS ENUM ('AI', 'HUMAN', 'API');

-- CreateEnum
CREATE TYPE "AppointmentReminderKind" AS ENUM ('H24', 'H2', 'M30');

-- CreateEnum
CREATE TYPE "AppointmentReminderStatus" AS ENUM ('SCHEDULED', 'SENT', 'FAILED', 'CANCELLED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "GoogleCalendarConnectionStatus" AS ENUM ('DISCONNECTED', 'CONNECTING', 'CONNECTED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "InstantFormStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "InstantFormAdPlatform" AS ENUM ('TIKTOK', 'FACEBOOK', 'INSTAGRAM', 'GOOGLE', 'SNAPCHAT', 'OTHER');

-- CreateEnum
CREATE TYPE "InstantFormOrderStatus" AS ENUM ('NEW', 'CONTACTED', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'SPAM');

-- CreateEnum
CREATE TYPE "SalesPartnerStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SalesReferralSource" AS ENUM ('CODE', 'LINK');

-- CreateEnum
CREATE TYPE "SalesCommissionKind" AS ENUM ('FIRST', 'RENEWAL');

-- CreateEnum
CREATE TYPE "SalesCommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'REJECTED');

-- CreateEnum
CREATE TYPE "SalesCommissionMode" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "SalesPayoutMethod" AS ENUM ('ZAIN_CASH', 'MASTERCARD');

-- CreateEnum
CREATE TYPE "SalesPayoutStatus" AS ENUM ('AWAITING_EMAIL', 'SUBMITTED', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CreativeProjectStatus" AS ENUM ('DRAFT', 'ANALYZING', 'GENERATING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "CreativeContentKind" AS ENUM ('PRODUCT_IMAGE', 'PRODUCT_MODEL', 'LIFESTYLE', 'SOCIAL_AD', 'UGC_VIDEO', 'COMMERCIAL', 'TALKING_MODEL', 'CINEMATIC');

-- CreateEnum
CREATE TYPE "CreativeJobType" AS ENUM ('PROBE', 'TEXT', 'IMAGE', 'VIDEO', 'TTS', 'LIPSYNC', 'UPSCALE', 'COMPOSE', 'EDIT');

-- CreateEnum
CREATE TYPE "CreativeJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'PROVIDER_SUBMITTED', 'POLLING', 'DOWNLOADING', 'STORING', 'QUALITY_CHECK', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CreativeAssetKind" AS ENUM ('PRODUCT_PHOTO', 'GENERATED_IMAGE', 'VIDEO', 'AUDIO', 'MUSIC', 'CAPTION');

-- CreateEnum
CREATE TYPE "OfficialWhatsAppSenderStatus" AS ENUM ('DISCONNECTED', 'CONNECTED', 'DISABLED', 'FAILED');

-- CreateEnum
CREATE TYPE "OfficialNotificationType" AS ENUM ('ACCOUNT_VERIFICATION_OTP', 'LOGIN_OTP', 'PASSWORD_RESET_OTP', 'SUBSCRIPTION_EXPIRING', 'SUBSCRIPTION_EXPIRING_SOON', 'SUBSCRIPTION_EXPIRED', 'PAYMENT_SUCCESSFUL', 'SUBSCRIPTION_ACTIVATED', 'SUBSCRIPTION_RENEWAL', 'SYSTEM_NOTIFICATION');

-- CreateEnum
CREATE TYPE "OfficialNotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "phoneVerifiedAt" TIMESTAMP(3),
    "emailVerifiedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "suspendedReason" TEXT,
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
CREATE TABLE "email_verifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "EmailVerificationType" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "businessId" TEXT,
    "provider" "ChannelProvider" NOT NULL,
    "purpose" "ChannelPurpose" NOT NULL DEFAULT 'INBOX',
    "name" TEXT NOT NULL,
    "status" "ChannelStatus" NOT NULL DEFAULT 'PENDING',
    "externalId" TEXT,
    "aiAgentId" TEXT,
    "whatsAppSessionId" TEXT,
    "whatsAppCloudAccountId" TEXT,
    "telegramConnectionId" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelToken" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT,
    "lastRefreshedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialOAuthSession" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "OAuthSessionStatus" NOT NULL DEFAULT 'PENDING',
    "encryptedPayload" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialOAuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramConnection" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "connectedByUserId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "telegramUserId" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "username" TEXT,
    "profilePhotoUrl" TEXT,
    "encryptedSession" TEXT,
    "status" "TelegramConnectionStatus" NOT NULL DEFAULT 'PENDING_CODE',
    "connectedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramAuthPending" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "encryptedTempSession" TEXT NOT NULL,
    "phoneCodeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramAuthPending_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppSession" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "purpose" "ChannelPurpose" NOT NULL DEFAULT 'INBOX',
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
    "kind" "ConversationKind" NOT NULL DEFAULT 'DIRECT_MESSAGE',
    "metadata" JSONB,
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
CREATE TABLE "ai_knowledge_embedding" (
    "chunk_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_knowledge_embedding_pkey" PRIMARY KEY ("chunk_id")
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
    "platform" "AiTrainingPlatform" NOT NULL DEFAULT 'WHATSAPP',
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
CREATE TABLE "StoreSettings" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "logoStorageKey" TEXT,
    "logoMimeType" TEXT,
    "deliveryMode" TEXT NOT NULL DEFAULT 'FIXED',
    "deliveryFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryRates" JSONB,
    "giftWhatsappPhone" TEXT,
    "defaultLocale" TEXT NOT NULL DEFAULT 'ar',
    "currency" TEXT NOT NULL DEFAULT 'IQD',
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "promoEnabled" BOOLEAN NOT NULL DEFAULT false,
    "promoEndsAt" TIMESTAMP(3),
    "promoText" TEXT,
    "themeKey" TEXT NOT NULL DEFAULT 'emerald',
    "themeColors" JSONB,
    "product_color_palette" JSONB,
    "pixel_integration_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreCategory" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageStorageKey" TEXT,
    "imageMimeType" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreTheme" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colors" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreBanner" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT,
    "title" TEXT,
    "subtitle" TEXT,
    "linkUrl" TEXT,
    "metadata" JSONB,
    "position" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreBanner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'IQD',
    "category" TEXT,
    "categoryId" TEXT,
    "metadata" JSONB,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "outOfStockManual" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
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
    "kind" "ProductMediaKind" NOT NULL DEFAULT 'IMAGE',
    "mimeType" TEXT,
    "fileName" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductStockMovement" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "bookingId" TEXT,
    "delta" INTEGER NOT NULL,
    "quantityAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiTrainingMedia" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "platform" "AiTrainingPlatform" NOT NULL DEFAULT 'WHATSAPP',
    "title" TEXT NOT NULL,
    "productName" TEXT,
    "description" TEXT,
    "mediaType" "AiTrainingMediaType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileName" TEXT,
    "sizeBytes" INTEGER,
    "tags" TEXT,
    "isVoiceNote" BOOLEAN NOT NULL DEFAULT false,
    "voice_library_type" TEXT,
    "category" TEXT,
    "language" TEXT,
    "duration_seconds" INTEGER,
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
    "items" JSONB,
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
CREATE TABLE "tiktok_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "team_id" TEXT,
    "open_id" TEXT NOT NULL,
    "display_name" TEXT,
    "avatar" TEXT,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "has_business_access" BOOLEAN NOT NULL DEFAULT false,
    "business_center_id" TEXT,
    "business_center_name" TEXT,
    "last_business_sync_at" TIMESTAMP(3),
    "business_sync_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiktok_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiktok_login_advertisers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "advertiser_id" TEXT NOT NULL,
    "name" TEXT,
    "currency" TEXT,
    "timezone" TEXT,
    "status" TEXT,
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiktok_login_advertisers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiktok_marketing_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "team_id" TEXT,
    "tiktok_open_id" TEXT,
    "oauth_scope" TEXT,
    "permissions_granted_at" TIMESTAMP(3),
    "marketing_access_token" TEXT NOT NULL,
    "marketing_refresh_token" TEXT,
    "marketing_expires_at" TIMESTAMP(3) NOT NULL,
    "marketing_refresh_expires_at" TIMESTAMP(3),
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "has_business_access" BOOLEAN NOT NULL DEFAULT false,
    "business_center_id" TEXT,
    "business_center_name" TEXT,
    "last_business_sync_at" TIMESTAMP(3),
    "business_sync_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiktok_marketing_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiktok_marketing_advertisers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "advertiser_id" TEXT NOT NULL,
    "name" TEXT,
    "currency" TEXT,
    "timezone" TEXT,
    "status" TEXT,
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiktok_marketing_advertisers_pkey1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiktok_ads_balance_checkouts" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "advertiser_id" TEXT NOT NULL,
    "advertiser_name" TEXT,
    "currency" TEXT,
    "status" "TikTokAdsBalanceCheckoutStatus" NOT NULL DEFAULT 'INITIATED',
    "destination_url" TEXT NOT NULL,
    "confirmation_source" TEXT,
    "balance_before" DOUBLE PRECISION,
    "balance_after" DOUBLE PRECISION,
    "last_checked_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiktok_ads_balance_checkouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TikTokAppCredentials" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "encryptedClientKey" TEXT NOT NULL,
    "encryptedClientSecret" TEXT NOT NULL,
    "redirectUri" TEXT,
    "clientKeyHint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TikTokAppCredentials_pkey" PRIMARY KEY ("id")
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
    "platformCampaignId" TEXT,
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

    CONSTRAINT "TikTokTrackingClick_pkey1" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiktok_integrations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "name" TEXT,
    "advertiser_id" TEXT,
    "advertiser_name" TEXT,
    "pixel_id" TEXT,
    "pixel_code" TEXT,
    "pixel_name" TEXT,
    "pixel_status" TEXT NOT NULL DEFAULT 'pending',
    "pixel_status_message" TEXT,
    "last_pixel_status_check_at" TIMESTAMP(3),
    "activated_at" TIMESTAMP(3),
    "encrypted_events_api_access_token" TEXT,
    "events_api_token_hint" TEXT,
    "events_api_connected" BOOLEAN NOT NULL DEFAULT false,
    "events_api_status" TEXT NOT NULL DEFAULT 'disconnected',
    "events_api_status_message" TEXT,
    "last_events_api_verification_at" TIMESTAMP(3),
    "last_event_sent_at" TIMESTAMP(3),
    "last_event_name" TEXT,
    "last_api_http_status" INTEGER,
    "last_api_error" TEXT,
    "whatsapp_number" TEXT,
    "redirect_destination_type" TEXT NOT NULL DEFAULT 'WHATSAPP_NUMBER',
    "external_redirect_url" TEXT,
    "redirect_slug" TEXT NOT NULL,
    "default_optimization_event" "TikTokOptimizationEvent" NOT NULL DEFAULT 'Contact',
    "custom_event_name" TEXT,
    "redirect_message" TEXT,
    "wizard_step" INTEGER NOT NULL DEFAULT 1,
    "wizard_completed" BOOLEAN NOT NULL DEFAULT false,
    "billing_suspended" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiktok_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiktok_event_configurations" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "event_name" "TikTokOptimizationEvent" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tiktok_event_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiktok_integration_clicks" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "ttclid" TEXT,
    "campaign_id" TEXT,
    "adgroup_id" TEXT,
    "ad_id" TEXT,
    "advertiser_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "page_view_sent" BOOLEAN NOT NULL DEFAULT false,
    "optimization_event_sent" BOOLEAN NOT NULL DEFAULT false,
    "events_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tiktok_integration_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiktok_integration_leads" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "click_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "contact_id" TEXT,
    "customer_phone" TEXT,
    "converted_at" TIMESTAMP(3),
    "conversion_event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tiktok_integration_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiktok_integration_conversions" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "click_id" TEXT,
    "conversation_id" TEXT,
    "message_id" TEXT,
    "contact_id" TEXT,
    "whatsapp_phone" TEXT,
    "event_id" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "ttclid" TEXT,
    "external_id" TEXT,
    "page_url" TEXT,
    "order_id" TEXT,
    "value_amount" DOUBLE PRECISION,
    "currency" TEXT,
    "first_message_at" TIMESTAMP(3),
    "contact_sent" BOOLEAN NOT NULL DEFAULT false,
    "tiktok_status" TEXT NOT NULL DEFAULT 'pending',
    "tiktok_response" JSONB,
    "tiktok_error" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tiktok_integration_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiktok_integration_inbound_diags" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "integration_id" TEXT,
    "channel_id" TEXT,
    "conversation_id" TEXT,
    "message_id" TEXT,
    "whatsapp_phone" TEXT,
    "business_phone" TEXT,
    "pixel_code" TEXT,
    "ttclid" TEXT,
    "is_new_conversation" BOOLEAN,
    "outcome" TEXT NOT NULL,
    "reason" TEXT,
    "tiktok_status" TEXT,
    "tiktok_response" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tiktok_integration_inbound_diags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiktok_integration_api_logs" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT,
    "conversion_id" TEXT,
    "event_name" TEXT NOT NULL,
    "event_id" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "http_status" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "processing_ms" INTEGER,
    "request_payload" JSONB,
    "response_body" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tiktok_integration_api_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "industry" TEXT,
    "timezone" TEXT DEFAULT 'UTC',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrafficSource" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "type" "CampaignSourceType" NOT NULL,
    "name" TEXT NOT NULL,
    "externalId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrafficSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "businessId" TEXT,
    "trafficSourceId" TEXT,
    "routingRuleId" TEXT,
    "aiAgentId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "whatsAppCloudAccountId" TEXT,
    "whatsAppSessionId" TEXT,
    "redirectMessage" TEXT,
    "utmDefaults" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppCloudAccount" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "businessId" TEXT,
    "aiAgentId" TEXT,
    "name" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "wabaId" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedVerifyToken" TEXT,
    "status" "WhatsAppCloudAccountStatus" NOT NULL DEFAULT 'PENDING',
    "defaultInboxLabel" TEXT,
    "connectedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppCloudAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppRoutingRule" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "strategy" "WhatsAppRoutingStrategy" NOT NULL DEFAULT 'MANUAL',
    "config" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppRoutingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppRoutingPoolMember" (
    "id" TEXT NOT NULL,
    "routingRuleId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "countryCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppRoutingPoolMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedirectLog" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "clickToken" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "device" TEXT,
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "resolvedAccountId" TEXT,
    "redirectedTo" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RedirectLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationWebhookEvent" (
    "id" TEXT NOT NULL,
    "teamId" TEXT,
    "provider" "WebhookProvider" NOT NULL,
    "eventType" TEXT NOT NULL,
    "externalId" TEXT,
    "payload" JSONB NOT NULL,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaConnection" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "businessId" TEXT,
    "channelId" TEXT,
    "pageId" TEXT,
    "instagramId" TEXT,
    "pageName" TEXT,
    "instagramHandle" TEXT,
    "profilePictureUrl" TEXT,
    "connectionSource" TEXT DEFAULT 'oauth',
    "user_access_token" TEXT,
    "page_access_token" TEXT,
    "user_access_token_expires_at" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'SUPPORT_AGENT',
    "roles" JSONB NOT NULL DEFAULT '[]',
    "residence" TEXT,
    "avatar_key" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "name_en" TEXT,
    "description" TEXT,
    "description_ar" TEXT,
    "description_en" TEXT,
    "price_cents" INTEGER NOT NULL,
    "yearly_price_cents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "interval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "trial_days" INTEGER NOT NULL DEFAULT 14,
    "features" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_recommended" BOOLEAN NOT NULL DEFAULT false,
    "accent_color" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_definitions" (
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "value_type" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description_ar" TEXT,
    "description_en" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "feature_definitions_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "plan_entitlements" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "feature_key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "limit_value" INTEGER,

    CONSTRAINT "plan_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "owner_user_id" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "trial_ends_at" TIMESTAMP(3),
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "expired_at" TIMESTAMP(3),
    "grace_purged_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "paused_at" TIMESTAMP(3),
    "auto_renew" BOOLEAN NOT NULL DEFAULT true,
    "mrr_cents" INTEGER NOT NULL DEFAULT 0,
    "billing_cycle" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "provider_ref" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "due_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "line_items" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "admin_user_id" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resource_id" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "team_id" TEXT,
    "category" "PlatformActivityCategory" NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "resource_id" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "channel" "AdminNotificationChannel" NOT NULL,
    "sent_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_assistant_articles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title_ar" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "body_ar" TEXT NOT NULL,
    "body_en" TEXT NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_builtin" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_assistant_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_assistant_conversations" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_assistant_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_assistant_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "helpful" BOOLEAN,
    "unanswered" BOOLEAN NOT NULL DEFAULT false,
    "media_type" TEXT,
    "media_url" TEXT,
    "media_mime" TEXT,
    "actions" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_assistant_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_voice_sessions" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'created',
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "model" TEXT NOT NULL,
    "voice" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'ar',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "duration_sec" INTEGER,
    "transcript" JSONB,
    "summary" TEXT,
    "usage" JSONB,
    "cost_millis" INTEGER,
    "handoff_requested" BOOLEAN NOT NULL DEFAULT false,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_voice_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_agents" (
    "id" TEXT NOT NULL,
    "team_id" TEXT,
    "name" TEXT NOT NULL DEFAULT 'Chatloora Voice',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "language" TEXT NOT NULL DEFAULT 'ar-AE',
    "voice_name" TEXT NOT NULL DEFAULT 'Polly.Zeina',
    "greeting" TEXT NOT NULL,
    "unclear_message" TEXT NOT NULL,
    "hold_message" TEXT NOT NULL,
    "handoff_message" TEXT NOT NULL,
    "max_duration_sec" INTEGER NOT NULL DEFAULT 600,
    "recording_enabled" BOOLEAN NOT NULL DEFAULT false,
    "transcript_enabled" BOOLEAN NOT NULL DEFAULT true,
    "summary_enabled" BOOLEAN NOT NULL DEFAULT true,
    "minutes_limit" INTEGER NOT NULL DEFAULT -1,
    "minutes_used" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_phone_numbers" (
    "id" TEXT NOT NULL,
    "team_id" TEXT,
    "agent_id" TEXT NOT NULL,
    "e164" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'twilio',
    "twilio_sid" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_phone_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_calls" (
    "id" TEXT NOT NULL,
    "team_id" TEXT,
    "agent_id" TEXT NOT NULL,
    "phone_number_id" TEXT,
    "provider_call_sid" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "caller_e164" TEXT NOT NULL,
    "called_e164" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ringing',
    "handled_by" TEXT NOT NULL DEFAULT 'AI',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "duration_sec" INTEGER,
    "outcome" TEXT,
    "recording_url" TEXT,
    "cost_cents" INTEGER,
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_transcript_turns" (
    "id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_transcript_turns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landing_offers" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "title_ar" TEXT,
    "description" TEXT,
    "description_ar" TEXT,
    "badge_text" TEXT,
    "badge_text_ar" TEXT,
    "cta_label" TEXT,
    "cta_label_ar" TEXT,
    "cta_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landing_page_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "content_en" JSONB NOT NULL,
    "content_ar" JSONB NOT NULL,
    "visibility" JSONB,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_page_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "team_id" TEXT,
    "user_id" TEXT,
    "assignee_id" TEXT,
    "subject" TEXT NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "author_id" TEXT,
    "body" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiktok_event_sets" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "advertiser_id" TEXT NOT NULL,
    "whatsapp_number" TEXT NOT NULL,
    "event_set_id" TEXT,
    "event_set_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiktok_event_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiktok_campaigns" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "team_id" TEXT,
    "advertiser_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "name" TEXT,
    "status" TEXT,
    "budget" DOUBLE PRECISION,
    "objective" TEXT,
    "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "cpc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "raw" JSONB,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiktok_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentBusinessProfile" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "vertical" "AppointmentVertical" NOT NULL DEFAULT 'CLINIC',
    "orgName" TEXT,
    "description" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Baghdad',
    "defaultDurationMin" INTEGER NOT NULL DEFAULT 30,
    "bufferMin" INTEGER NOT NULL DEFAULT 0,
    "bufferBeforeMin" INTEGER NOT NULL DEFAULT 0,
    "bufferAfterMin" INTEGER NOT NULL DEFAULT 0,
    "breakMin" INTEGER NOT NULL DEFAULT 0,
    "maxDailyAppointments" INTEGER,
    "bookingWindowDays" INTEGER NOT NULL DEFAULT 30,
    "instructions" TEXT,
    "faqJson" JSONB,
    "clinicKnowledge" JSONB,
    "businessHours" JSONB,
    "aiCanReply" BOOLEAN NOT NULL DEFAULT true,
    "aiCanCreate" BOOLEAN NOT NULL DEFAULT true,
    "aiCanUpdate" BOOLEAN NOT NULL DEFAULT true,
    "aiCanCancel" BOOLEAN NOT NULL DEFAULT true,
    "aiCanReadCalendar" BOOLEAN NOT NULL DEFAULT true,
    "aiCanSendReminders" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentBusinessProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentStaff" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "specialty" TEXT,
    "bio" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentServiceOffer" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "staffId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "priceCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'IQD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentServiceOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleCalendarConnection" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "status" "GoogleCalendarConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "googleAccountEmail" TEXT,
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "calendarSummary" TEXT,
    "calendarTimeZone" TEXT,
    "syncToken" TEXT,
    "connectedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleCalendarConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleCalendarToken" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleCalendarToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "conversationId" TEXT,
    "contactId" TEXT,
    "staffId" TEXT,
    "serviceId" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "source" "AppointmentSource" NOT NULL DEFAULT 'AI',
    "googleEventId" TEXT,
    "googleCalendarId" TEXT,
    "syncOrigin" TEXT,
    "notes" TEXT,
    "cancelReason" TEXT,
    "confirmationSentAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentReminder" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "kind" "AppointmentReminderKind" NOT NULL,
    "status" "AppointmentReminderStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "jobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instant_forms" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "created_by_user_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "short_code" TEXT NOT NULL,
    "ad_platform" "InstantFormAdPlatform" NOT NULL DEFAULT 'TIKTOK',
    "ad_account_label" TEXT,
    "status" "InstantFormStatus" NOT NULL DEFAULT 'DRAFT',
    "template_key" TEXT,
    "draft_document" JSONB NOT NULL,
    "published_document" JSONB,
    "published_at" TIMESTAMP(3),
    "whatsapp_number" TEXT,
    "pixel_integration_id" TEXT,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instant_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instant_form_versions" (
    "id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT,
    "document" JSONB NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instant_form_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instant_form_orders" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "status" "InstantFormOrderStatus" NOT NULL DEFAULT 'NEW',
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "customer_whatsapp" TEXT,
    "customer_email" TEXT,
    "city" TEXT,
    "governorate" TEXT,
    "address" TEXT,
    "product_name" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2),
    "total_price" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'IQD',
    "answers" JSONB NOT NULL,
    "notes" TEXT,
    "internal_notes" TEXT,
    "ad_platform" "InstantFormAdPlatform",
    "ad_account_label" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "device_type" TEXT,
    "browser" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "utm_content" TEXT,
    "utm_term" TEXT,
    "ttclid" TEXT,
    "fbclid" TEXT,
    "gclid" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instant_form_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_partners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "user_id" TEXT,
    "age" INTEGER,
    "city" TEXT,
    "avatar_key" TEXT,
    "join_code_hash" TEXT,
    "join_code_expires_at" TIMESTAMP(3),
    "status" "SalesPartnerStatus" NOT NULL DEFAULT 'PENDING',
    "referral_code" TEXT,
    "password_hash" TEXT,
    "password_encrypted" TEXT,
    "notes" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_commission_rules" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "mode" "SalesCommissionMode" NOT NULL DEFAULT 'PERCENT',
    "percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "fixed_cents" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_commission_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_referrals" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT,
    "source" "SalesReferralSource" NOT NULL,
    "code_used" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_commissions" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "referral_id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "kind" "SalesCommissionKind" NOT NULL,
    "status" "SalesCommissionStatus" NOT NULL DEFAULT 'PENDING',
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IQD',
    "sale_cents" INTEGER NOT NULL,
    "note" TEXT,
    "approved_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_payout_requests" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IQD',
    "account_number" TEXT NOT NULL,
    "account_name" TEXT,
    "method" "SalesPayoutMethod",
    "fee_cents" INTEGER NOT NULL DEFAULT 0,
    "net_cents" INTEGER NOT NULL DEFAULT 0,
    "account_image_key" TEXT,
    "receipt_image_key" TEXT,
    "email_code_hash" TEXT,
    "email_code_expires_at" TIMESTAMP(3),
    "email_verified_at" TIMESTAMP(3),
    "status" "SalesPayoutStatus" NOT NULL DEFAULT 'AWAITING_EMAIL',
    "admin_note" TEXT,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_payout_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeProject" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CreativeProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "contentKind" "CreativeContentKind",
    "aspectRatio" TEXT,
    "durationSec" INTEGER,
    "locale" TEXT NOT NULL DEFAULT 'ar-IQ',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeProductProfile" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION,
    "currency" TEXT,
    "ingredients" TEXT,
    "benefits" TEXT,
    "usage" TEXT,
    "targetAudience" TEXT,
    "extra" TEXT,
    "category" TEXT,
    "brand" TEXT,
    "userClaims" TEXT,
    "intelligence" JSONB,
    "analyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeProductProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeProductAsset" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileName" TEXT,
    "sizeBytes" INTEGER,
    "checksum" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "kind" TEXT NOT NULL DEFAULT 'PRODUCT_PHOTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreativeProductAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeModelProfile" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT,
    "ageRange" TEXT,
    "skinTone" TEXT,
    "hair" TEXT,
    "hairStyle" TEXT,
    "eyeColor" TEXT,
    "bodyType" TEXT,
    "persona" TEXT,
    "personality" TEXT,
    "clothing" TEXT,
    "clothingCustom" TEXT,
    "appearance" TEXT,
    "faceStorageKey" TEXT,
    "expression" TEXT,
    "pose" TEXT,
    "profession" TEXT,
    "visualIdentity" TEXT,
    "environment" TEXT,
    "voiceProfileId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeModelProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeScript" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'ar-IQ',
    "tone" TEXT,
    "durationSec" INTEGER,
    "hook" TEXT,
    "body" TEXT,
    "cta" TEXT,
    "rawText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeScript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeScriptScene" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "startSec" DOUBLE PRECISION,
    "endSec" DOUBLE PRECISION,
    "visual" TEXT,
    "voiceover" TEXT,
    "camera" TEXT,
    "lighting" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeScriptScene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeGenerationJob" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "CreativeJobType" NOT NULL,
    "status" "CreativeJobStatus" NOT NULL DEFAULT 'QUEUED',
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "idempotencyKey" TEXT,
    "payload" JSONB,
    "result" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "providerJobId" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sceneId" TEXT,

    CONSTRAINT "CreativeGenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeGenerationAsset" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "projectId" TEXT,
    "kind" "CreativeAssetKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "checksum" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "durationSec" DOUBLE PRECISION,
    "provider" TEXT,
    "model" TEXT,
    "requestedResolution" TEXT,
    "actualResolution" TEXT,
    "resolutionType" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreativeGenerationAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeVideoVersion" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "jobId" TEXT,
    "assetId" TEXT,
    "editRequestId" TEXT,
    "parentVersionId" TEXT,
    "version" INTEGER NOT NULL,
    "label" TEXT,
    "notes" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "snapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreativeVideoVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeEditRequest" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "jobId" TEXT,
    "instruction" TEXT NOT NULL,
    "parsedPlan" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeEditRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeVoiceProfile" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT,
    "age" TEXT,
    "style" TEXT,
    "language" TEXT NOT NULL DEFAULT 'ar-IQ',
    "provider" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeVoiceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeMusicTrack" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "style" TEXT,
    "genre" TEXT,
    "mood" TEXT,
    "license" TEXT,
    "licenseSource" TEXT,
    "licenseNote" TEXT,
    "attribution" TEXT,
    "usageRestrictions" TEXT,
    "licenseConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "durationSec" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreativeMusicTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeUsageRecord" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "operation" TEXT NOT NULL,
    "durationSec" DOUBLE PRECISION,
    "resolution" TEXT,
    "estimatedCost" DOUBLE PRECISION,
    "actualCost" DOUBLE PRECISION,
    "costStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "currency" TEXT,
    "mediaType" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreativeUsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeQualityCheck" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "score" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "findings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreativeQualityCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeBrief" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "objective" TEXT,
    "audience" TEXT,
    "platform" TEXT,
    "aspectRatio" TEXT,
    "visualStyle" TEXT,
    "environment" TEXT,
    "lighting" TEXT,
    "cameraStyle" TEXT,
    "modelRequirements" TEXT,
    "productPlacement" TEXT,
    "messaging" TEXT,
    "restrictions" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeConcept" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeConcept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeVideoScene" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "durationSec" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "role" TEXT,
    "script" TEXT,
    "imageAssetId" TEXT,
    "videoAssetId" TEXT,
    "voiceAssetId" TEXT,
    "musicTrackId" TEXT,
    "captions" JSONB,
    "transition" TEXT,
    "camera" TEXT,
    "modelProfileId" TEXT,
    "environment" TEXT,
    "visualInstructions" TEXT,
    "metadata" JSONB,
    "generationJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeVideoScene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeContinuityProfile" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "productAppearance" TEXT,
    "modelProfileId" TEXT,
    "clothing" TEXT,
    "brandIdentity" TEXT,
    "visualStyle" TEXT,
    "colorPalette" TEXT,
    "lighting" TEXT,
    "environment" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeContinuityProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeCaptionTrack" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneId" TEXT,
    "language" TEXT NOT NULL DEFAULT 'ar',
    "cues" JSONB NOT NULL,
    "style" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeCaptionTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeStudioModelConfig" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "maxResolution" TEXT,
    "maxDurationSec" INTEGER,
    "qualityScore" DOUBLE PRECISION,
    "estimatedCostUsd" DOUBLE PRECISION,
    "capabilities" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeStudioModelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeStudioSetting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "defaultImageModel" TEXT,
    "defaultVideoModel" TEXT,
    "featureFlags" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeStudioSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "official_whatsapp_senders" (
    "id" TEXT NOT NULL DEFAULT 'chatloora-official',
    "waba_id" TEXT NOT NULL DEFAULT '',
    "phone_number_id" TEXT NOT NULL DEFAULT '',
    "display_phone_number" TEXT NOT NULL DEFAULT '',
    "display_name" TEXT NOT NULL DEFAULT '',
    "encrypted_access_token" TEXT NOT NULL DEFAULT '',
    "status" "OfficialWhatsAppSenderStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "webhook_status" TEXT NOT NULL DEFAULT 'unknown',
    "last_tested_at" TIMESTAMP(3),
    "last_error" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "official_whatsapp_senders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "official_whatsapp_templates" (
    "id" TEXT NOT NULL,
    "type" "OfficialNotificationType" NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "official_whatsapp_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "official_whatsapp_otp_config" (
    "id" TEXT NOT NULL DEFAULT 'otp',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "login_enabled" BOOLEAN NOT NULL DEFAULT false,
    "password_reset_enabled" BOOLEAN NOT NULL DEFAULT false,
    "template_name" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL DEFAULT 'en',
    "expiry_seconds" INTEGER NOT NULL DEFAULT 600,
    "resend_cooldown_seconds" INTEGER NOT NULL DEFAULT 60,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "official_whatsapp_otp_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "official_subscription_notify_config" (
    "id" TEXT NOT NULL DEFAULT 'subscription',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "reminder1_days" INTEGER NOT NULL DEFAULT 7,
    "reminder1_enabled" BOOLEAN NOT NULL DEFAULT true,
    "reminder2_days" INTEGER NOT NULL DEFAULT 1,
    "reminder2_enabled" BOOLEAN NOT NULL DEFAULT true,
    "expired_enabled" BOOLEAN NOT NULL DEFAULT true,
    "payment_enabled" BOOLEAN NOT NULL DEFAULT false,
    "activated_enabled" BOOLEAN NOT NULL DEFAULT false,
    "renewal_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "official_subscription_notify_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_notification_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "subscription_id" TEXT NOT NULL,
    "team_id" TEXT,
    "notification_type" "OfficialNotificationType" NOT NULL,
    "template_name" TEXT NOT NULL,
    "status" "OfficialNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "provider_message_id" TEXT,
    "scheduled_date" DATE NOT NULL,
    "phone" TEXT,
    "sent_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_otp_verifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "purpose" TEXT NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "verified_at" TIMESTAMP(3),
    "last_sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_otp_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domain_mailboxes" (
    "id" TEXT NOT NULL,
    "local_part" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "password_hash" TEXT NOT NULL,
    "password_encrypted" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "last_login_at" TIMESTAMP(3),
    "created_by_admin_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domain_mailboxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domain_mailbox_messages" (
    "id" TEXT NOT NULL,
    "mailbox_id" TEXT NOT NULL,
    "folder" TEXT NOT NULL DEFAULT 'INBOX',
    "direction" TEXT NOT NULL,
    "resend_email_id" TEXT,
    "message_id_header" TEXT,
    "from_address" TEXT NOT NULL,
    "to_addresses" TEXT NOT NULL,
    "cc_addresses" TEXT,
    "bcc_addresses" TEXT,
    "subject" TEXT NOT NULL DEFAULT '',
    "text_body" TEXT,
    "html_body" TEXT,
    "preview" TEXT NOT NULL DEFAULT '',
    "seen" BOOLEAN NOT NULL DEFAULT false,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "has_attachments" BOOLEAN NOT NULL DEFAULT false,
    "attachments_json" JSONB,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domain_mailbox_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiktok_adgroups" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "team_id" TEXT,
    "advertiser_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "adgroup_id" TEXT NOT NULL,
    "name" TEXT,
    "status" TEXT,
    "billing_event" TEXT,
    "budget" DOUBLE PRECISION,
    "raw" JSONB,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiktok_adgroups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiktok_ads" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "team_id" TEXT,
    "advertiser_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "adgroup_id" TEXT,
    "ad_id" TEXT NOT NULL,
    "name" TEXT,
    "status" TEXT,
    "raw" JSONB,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiktok_ads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiktok_advertisers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "advertiser_id" TEXT NOT NULL,
    "name" TEXT,
    "currency" TEXT,
    "timezone" TEXT,
    "status" TEXT,
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "team_id" TEXT,

    CONSTRAINT "tiktok_marketing_advertisers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiktok_api_logs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'POST',
    "request_body" JSONB,
    "response_body" JSONB,
    "advertiser_id" TEXT,
    "event_set_id" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "http_status" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tiktok_api_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiktok_clicks" (
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
    "advertiserId" TEXT,
    "campaign_id" TEXT,
    "adgroup_id" TEXT,
    "ad_id" TEXT,

    CONSTRAINT "TikTokTrackingClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiktok_message_event_sets" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "advertiser_id" TEXT NOT NULL,
    "whatsapp_number" TEXT NOT NULL,
    "event_set_id" TEXT,
    "event_set_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error_code" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiktok_message_event_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiktok_whatsapp_mappings" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "campaign_local_id" TEXT,
    "advertiser_id" TEXT,
    "campaign_id" TEXT,
    "adgroup_id" TEXT,
    "ad_id" TEXT,
    "whatsapp_number" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "event_set_id" TEXT,

    CONSTRAINT "tiktok_whatsapp_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

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
CREATE INDEX "email_verifications_email_type_idx" ON "email_verifications"("email", "type");

-- CreateIndex
CREATE INDEX "email_verifications_user_id_idx" ON "email_verifications"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_whatsAppSessionId_key" ON "Channel"("whatsAppSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_whatsAppCloudAccountId_key" ON "Channel"("whatsAppCloudAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_telegramConnectionId_key" ON "Channel"("telegramConnectionId");

-- CreateIndex
CREATE INDEX "Channel_teamId_status_idx" ON "Channel"("teamId", "status");

-- CreateIndex
CREATE INDEX "Channel_teamId_purpose_idx" ON "Channel"("teamId", "purpose");

-- CreateIndex
CREATE INDEX "Channel_teamId_provider_purpose_idx" ON "Channel"("teamId", "provider", "purpose");

-- CreateIndex
CREATE INDEX "Channel_teamId_businessId_idx" ON "Channel"("teamId", "businessId");

-- CreateIndex
CREATE INDEX "Channel_aiAgentId_idx" ON "Channel"("aiAgentId");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_teamId_provider_externalId_key" ON "Channel"("teamId", "provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelToken_channelId_key" ON "ChannelToken"("channelId");

-- CreateIndex
CREATE INDEX "SocialOAuthSession_teamId_provider_status_idx" ON "SocialOAuthSession"("teamId", "provider", "status");

-- CreateIndex
CREATE INDEX "SocialOAuthSession_expiresAt_idx" ON "SocialOAuthSession"("expiresAt");

-- CreateIndex
CREATE INDEX "TelegramConnection_teamId_status_idx" ON "TelegramConnection"("teamId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramConnection_teamId_phoneNumber_key" ON "TelegramConnection"("teamId", "phoneNumber");

-- CreateIndex
CREATE INDEX "TelegramAuthPending_teamId_userId_idx" ON "TelegramAuthPending"("teamId", "userId");

-- CreateIndex
CREATE INDEX "TelegramAuthPending_expiresAt_idx" ON "TelegramAuthPending"("expiresAt");

-- CreateIndex
CREATE INDEX "WhatsAppSession_teamId_status_idx" ON "WhatsAppSession"("teamId", "status");

-- CreateIndex
CREATE INDEX "WhatsAppSession_teamId_purpose_idx" ON "WhatsAppSession"("teamId", "purpose");

-- CreateIndex
CREATE INDEX "WhatsAppSession_teamId_createdByUserId_idx" ON "WhatsAppSession"("teamId", "createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppSession_teamId_phoneNumber_purpose_key" ON "WhatsAppSession"("teamId", "phoneNumber", "purpose");

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
CREATE INDEX "Conversation_teamId_kind_lastMessageAt_idx" ON "Conversation"("teamId", "kind", "lastMessageAt");

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
CREATE INDEX "AiAgent_teamId_type_idx" ON "AiAgent"("teamId", "type");

-- CreateIndex
CREATE INDEX "AiAgent_teamId_enabled_idx" ON "AiAgent"("teamId", "enabled");

-- CreateIndex
CREATE INDEX "AiKnowledgeSource_teamId_type_idx" ON "AiKnowledgeSource"("teamId", "type");

-- CreateIndex
CREATE INDEX "AiKnowledgeDocument_teamId_status_idx" ON "AiKnowledgeDocument"("teamId", "status");

-- CreateIndex
CREATE INDEX "AiKnowledgeChunk_teamId_documentId_idx" ON "AiKnowledgeChunk"("teamId", "documentId");

-- CreateIndex
CREATE INDEX "ai_knowledge_embedding_team_idx" ON "ai_knowledge_embedding"("team_id");

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
CREATE UNIQUE INDEX "AiSettings_teamId_platform_key" ON "AiSettings"("teamId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "AiProviderConfig_teamId_key" ON "AiProviderConfig"("teamId");

-- CreateIndex
CREATE INDEX "ConversationTransfer_teamId_createdAt_idx" ON "ConversationTransfer"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "ConversationTransfer_conversationId_createdAt_idx" ON "ConversationTransfer"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "AutomationRule_teamId_enabled_priority_idx" ON "AutomationRule"("teamId", "enabled", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "StoreSettings_teamId_key" ON "StoreSettings"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreSettings_slug_key" ON "StoreSettings"("slug");

-- CreateIndex
CREATE INDEX "StoreSettings_slug_idx" ON "StoreSettings"("slug");

-- CreateIndex
CREATE INDEX "StoreSettings_pixel_integration_id_idx" ON "StoreSettings"("pixel_integration_id");

-- CreateIndex
CREATE INDEX "StoreCategory_teamId_position_idx" ON "StoreCategory"("teamId", "position");

-- CreateIndex
CREATE INDEX "StoreCategory_teamId_isActive_idx" ON "StoreCategory"("teamId", "isActive");

-- CreateIndex
CREATE INDEX "StoreTheme_teamId_createdAt_idx" ON "StoreTheme"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "StoreBanner_teamId_position_idx" ON "StoreBanner"("teamId", "position");

-- CreateIndex
CREATE INDEX "Product_teamId_isActive_idx" ON "Product"("teamId", "isActive");

-- CreateIndex
CREATE INDEX "Product_teamId_name_idx" ON "Product"("teamId", "name");

-- CreateIndex
CREATE INDEX "Product_teamId_position_idx" ON "Product"("teamId", "position");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "ProductImage_productId_position_idx" ON "ProductImage"("productId", "position");

-- CreateIndex
CREATE INDEX "ProductStockMovement_teamId_createdAt_idx" ON "ProductStockMovement"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductStockMovement_productId_createdAt_idx" ON "ProductStockMovement"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductStockMovement_bookingId_idx" ON "ProductStockMovement"("bookingId");

-- CreateIndex
CREATE INDEX "AiTrainingMedia_teamId_platform_createdAt_idx" ON "AiTrainingMedia"("teamId", "platform", "createdAt");

-- CreateIndex
CREATE INDEX "AiTrainingMedia_teamId_platform_productName_idx" ON "AiTrainingMedia"("teamId", "platform", "productName");

-- CreateIndex
CREATE INDEX "AiTrainingMedia_teamId_platform_isVoiceNote_idx" ON "AiTrainingMedia"("teamId", "platform", "isVoiceNote");

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
CREATE UNIQUE INDEX "tiktok_accounts_user_id_key" ON "tiktok_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tiktok_accounts_open_id_key" ON "tiktok_accounts"("open_id");

-- CreateIndex
CREATE INDEX "tiktok_accounts_open_id_idx" ON "tiktok_accounts"("open_id");

-- CreateIndex
CREATE INDEX "tiktok_accounts_team_id_idx" ON "tiktok_accounts"("team_id");

-- CreateIndex
CREATE INDEX "tiktok_login_advertisers_user_id_idx" ON "tiktok_login_advertisers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tiktok_login_advertisers_user_id_advertiser_id_key" ON "tiktok_login_advertisers"("user_id", "advertiser_id");

-- CreateIndex
CREATE UNIQUE INDEX "tiktok_marketing_connections_user_id_key" ON "tiktok_marketing_connections"("user_id");

-- CreateIndex
CREATE INDEX "tiktok_marketing_connections_team_id_idx" ON "tiktok_marketing_connections"("team_id");

-- CreateIndex
CREATE INDEX "tiktok_mkt_advertisers_user_idx" ON "tiktok_marketing_advertisers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tiktok_mkt_advertisers_user_advertiser_key" ON "tiktok_marketing_advertisers"("user_id", "advertiser_id");

-- CreateIndex
CREATE INDEX "tiktok_ads_balance_checkouts_team_id_created_at_idx" ON "tiktok_ads_balance_checkouts"("team_id", "created_at");

-- CreateIndex
CREATE INDEX "tiktok_ads_balance_checkouts_user_id_created_at_idx" ON "tiktok_ads_balance_checkouts"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "tiktok_ads_balance_checkouts_team_id_advertiser_id_idx" ON "tiktok_ads_balance_checkouts"("team_id", "advertiser_id");

-- CreateIndex
CREATE UNIQUE INDEX "TikTokAppCredentials_teamId_key" ON "TikTokAppCredentials"("teamId");

-- CreateIndex
CREATE INDEX "TikTokAppCredentials_teamId_idx" ON "TikTokAppCredentials"("teamId");

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
CREATE UNIQUE INDEX "TikTokCampaign_platformCampaignId_key" ON "TikTokCampaign"("platformCampaignId");

-- CreateIndex
CREATE INDEX "TikTokCampaign_teamId_active_idx" ON "TikTokCampaign"("teamId", "active");

-- CreateIndex
CREATE INDEX "TikTokCampaign_accountId_idx" ON "TikTokCampaign"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "TikTokTrackingClick_click_token_key" ON "TikTokTrackingClick"("clickToken");

-- CreateIndex
CREATE INDEX "TikTokTrackingClick_team_created_idx" ON "TikTokTrackingClick"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "TikTokTrackingClick_campaign_idx" ON "TikTokTrackingClick"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "tiktok_integrations_redirect_slug_key" ON "tiktok_integrations"("redirect_slug");

-- CreateIndex
CREATE INDEX "tiktok_integrations_user_id_team_id_idx" ON "tiktok_integrations"("user_id", "team_id");

-- CreateIndex
CREATE INDEX "tiktok_integrations_team_id_idx" ON "tiktok_integrations"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "tiktok_event_configurations_integration_id_event_name_key" ON "tiktok_event_configurations"("integration_id", "event_name");

-- CreateIndex
CREATE INDEX "tiktok_integration_clicks_integration_id_created_at_idx" ON "tiktok_integration_clicks"("integration_id", "created_at");

-- CreateIndex
CREATE INDEX "tiktok_integration_clicks_campaign_id_idx" ON "tiktok_integration_clicks"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "tiktok_integration_leads_click_id_key" ON "tiktok_integration_leads"("click_id");

-- CreateIndex
CREATE UNIQUE INDEX "tiktok_integration_leads_conversation_id_key" ON "tiktok_integration_leads"("conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "tiktok_integration_leads_conversion_event_id_key" ON "tiktok_integration_leads"("conversion_event_id");

-- CreateIndex
CREATE INDEX "tiktok_integration_leads_integration_id_created_at_idx" ON "tiktok_integration_leads"("integration_id", "created_at");

-- CreateIndex
CREATE INDEX "tiktok_integration_leads_integration_id_converted_at_idx" ON "tiktok_integration_leads"("integration_id", "converted_at");

-- CreateIndex
CREATE UNIQUE INDEX "tiktok_integration_conversions_event_id_key" ON "tiktok_integration_conversions"("event_id");

-- CreateIndex
CREATE INDEX "tiktok_integration_conversions_integration_id_conversation__idx" ON "tiktok_integration_conversions"("integration_id", "conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "tiktok_integration_conversions_integration_id_whatsapp_phon_idx" ON "tiktok_integration_conversions"("integration_id", "whatsapp_phone", "sent_at");

-- CreateIndex
CREATE INDEX "tiktok_integration_conversions_integration_id_event_name_se_idx" ON "tiktok_integration_conversions"("integration_id", "event_name", "sent_at");

-- CreateIndex
CREATE INDEX "tiktok_integration_conversions_tiktok_status_next_retry_at_idx" ON "tiktok_integration_conversions"("tiktok_status", "next_retry_at");

-- CreateIndex
CREATE UNIQUE INDEX "tiktok_integration_conversions_integration_id_event_name_co_key" ON "tiktok_integration_conversions"("integration_id", "event_name", "conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "tiktok_integration_conversions_integration_id_event_name_me_key" ON "tiktok_integration_conversions"("integration_id", "event_name", "message_id");

-- CreateIndex
CREATE UNIQUE INDEX "tiktok_integration_conversions_integration_id_event_name_or_key" ON "tiktok_integration_conversions"("integration_id", "event_name", "order_id");

-- CreateIndex
CREATE INDEX "tiktok_integration_inbound_diags_team_id_created_at_idx" ON "tiktok_integration_inbound_diags"("team_id", "created_at");

-- CreateIndex
CREATE INDEX "tiktok_integration_inbound_diags_integration_id_created_at_idx" ON "tiktok_integration_inbound_diags"("integration_id", "created_at");

-- CreateIndex
CREATE INDEX "tiktok_integration_api_logs_integration_id_created_at_idx" ON "tiktok_integration_api_logs"("integration_id", "created_at");

-- CreateIndex
CREATE INDEX "tiktok_integration_api_logs_conversion_id_attempt_idx" ON "tiktok_integration_api_logs"("conversion_id", "attempt");

-- CreateIndex
CREATE INDEX "Business_teamId_idx" ON "Business"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Business_teamId_slug_key" ON "Business"("teamId", "slug");

-- CreateIndex
CREATE INDEX "TrafficSource_teamId_type_idx" ON "TrafficSource"("teamId", "type");

-- CreateIndex
CREATE INDEX "Campaign_teamId_active_idx" ON "Campaign"("teamId", "active");

-- CreateIndex
CREATE INDEX "Campaign_businessId_idx" ON "Campaign"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_teamId_slug_key" ON "Campaign"("teamId", "slug");

-- CreateIndex
CREATE INDEX "WhatsAppCloudAccount_teamId_status_idx" ON "WhatsAppCloudAccount"("teamId", "status");

-- CreateIndex
CREATE INDEX "WhatsAppCloudAccount_businessId_idx" ON "WhatsAppCloudAccount"("businessId");

-- CreateIndex
CREATE INDEX "WhatsAppCloudAccount_aiAgentId_idx" ON "WhatsAppCloudAccount"("aiAgentId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppCloudAccount_teamId_phoneNumberId_key" ON "WhatsAppCloudAccount"("teamId", "phoneNumberId");

-- CreateIndex
CREATE INDEX "WhatsAppRoutingRule_teamId_active_idx" ON "WhatsAppRoutingRule"("teamId", "active");

-- CreateIndex
CREATE INDEX "WhatsAppRoutingPoolMember_routingRuleId_idx" ON "WhatsAppRoutingPoolMember"("routingRuleId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppRoutingPoolMember_routingRuleId_accountId_key" ON "WhatsAppRoutingPoolMember"("routingRuleId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "RedirectLog_clickToken_key" ON "RedirectLog"("clickToken");

-- CreateIndex
CREATE INDEX "RedirectLog_teamId_createdAt_idx" ON "RedirectLog"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "RedirectLog_campaignId_idx" ON "RedirectLog"("campaignId");

-- CreateIndex
CREATE INDEX "IntegrationWebhookEvent_teamId_provider_createdAt_idx" ON "IntegrationWebhookEvent"("teamId", "provider", "createdAt");

-- CreateIndex
CREATE INDEX "IntegrationWebhookEvent_status_createdAt_idx" ON "IntegrationWebhookEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "IntegrationWebhookEvent_externalId_idx" ON "IntegrationWebhookEvent"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaConnection_channelId_key" ON "MetaConnection"("channelId");

-- CreateIndex
CREATE INDEX "MetaConnection_teamId_idx" ON "MetaConnection"("teamId");

-- CreateIndex
CREATE INDEX "MetaConnection_pageId_idx" ON "MetaConnection"("pageId");

-- CreateIndex
CREATE INDEX "MetaConnection_instagramId_idx" ON "MetaConnection"("instagramId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaConnection_teamId_pageId_key" ON "MetaConnection"("teamId", "pageId");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_user_id_key" ON "admin_users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_slug_key" ON "subscription_plans"("slug");

-- CreateIndex
CREATE INDEX "feature_definitions_category_sort_order_idx" ON "feature_definitions"("category", "sort_order");

-- CreateIndex
CREATE INDEX "plan_entitlements_feature_key_idx" ON "plan_entitlements"("feature_key");

-- CreateIndex
CREATE UNIQUE INDEX "plan_entitlements_plan_id_feature_key_key" ON "plan_entitlements"("plan_id", "feature_key");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_team_id_key" ON "subscriptions"("team_id");

-- CreateIndex
CREATE INDEX "subscriptions_plan_id_idx" ON "subscriptions"("plan_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "payments_subscription_id_idx" ON "payments"("subscription_id");

-- CreateIndex
CREATE INDEX "payments_team_id_created_at_idx" ON "payments"("team_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- CreateIndex
CREATE INDEX "invoices_team_id_created_at_idx" ON "invoices"("team_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_admin_user_id_idx" ON "audit_logs"("admin_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "activity_logs_category_created_at_idx" ON "activity_logs"("category", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_team_id_created_at_idx" ON "activity_logs"("team_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_user_id_created_at_idx" ON "activity_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_notifications_user_id_created_at_idx" ON "admin_notifications"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE INDEX "system_settings_category_idx" ON "system_settings"("category");

-- CreateIndex
CREATE UNIQUE INDEX "platform_assistant_articles_slug_key" ON "platform_assistant_articles"("slug");

-- CreateIndex
CREATE INDEX "platform_assistant_articles_category_is_active_idx" ON "platform_assistant_articles"("category", "is_active");

-- CreateIndex
CREATE INDEX "platform_assistant_conversations_user_id_updated_at_idx" ON "platform_assistant_conversations"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "platform_assistant_conversations_team_id_updated_at_idx" ON "platform_assistant_conversations"("team_id", "updated_at");

-- CreateIndex
CREATE INDEX "platform_assistant_messages_conversation_id_created_at_idx" ON "platform_assistant_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "assistant_voice_sessions_team_id_started_at_idx" ON "assistant_voice_sessions"("team_id", "started_at");

-- CreateIndex
CREATE INDEX "assistant_voice_sessions_user_id_started_at_idx" ON "assistant_voice_sessions"("user_id", "started_at");

-- CreateIndex
CREATE INDEX "assistant_voice_sessions_status_started_at_idx" ON "assistant_voice_sessions"("status", "started_at");

-- CreateIndex
CREATE INDEX "voice_agents_team_id_idx" ON "voice_agents"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "voice_phone_numbers_e164_key" ON "voice_phone_numbers"("e164");

-- CreateIndex
CREATE INDEX "voice_phone_numbers_team_id_idx" ON "voice_phone_numbers"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "voice_calls_provider_call_sid_key" ON "voice_calls"("provider_call_sid");

-- CreateIndex
CREATE INDEX "voice_calls_team_id_started_at_idx" ON "voice_calls"("team_id", "started_at");

-- CreateIndex
CREATE INDEX "voice_calls_status_started_at_idx" ON "voice_calls"("status", "started_at");

-- CreateIndex
CREATE INDEX "voice_transcript_turns_call_id_created_at_idx" ON "voice_transcript_turns"("call_id", "created_at");

-- CreateIndex
CREATE INDEX "landing_offers_is_active_sort_order_idx" ON "landing_offers"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "support_tickets_status_created_at_idx" ON "support_tickets"("status", "created_at");

-- CreateIndex
CREATE INDEX "support_tickets_team_id_idx" ON "support_tickets"("team_id");

-- CreateIndex
CREATE INDEX "support_tickets_user_id_idx" ON "support_tickets"("user_id");

-- CreateIndex
CREATE INDEX "ticket_messages_ticket_id_created_at_idx" ON "ticket_messages"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "tiktok_event_sets_workspace_id_idx" ON "tiktok_event_sets"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "tiktok_event_sets_workspace_id_advertiser_id_whatsapp_numbe_key" ON "tiktok_event_sets"("workspace_id", "advertiser_id", "whatsapp_number");

-- CreateIndex
CREATE INDEX "tiktok_campaigns_advertiser_id_idx" ON "tiktok_campaigns"("advertiser_id");

-- CreateIndex
CREATE INDEX "tiktok_campaigns_team_id_idx" ON "tiktok_campaigns"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentBusinessProfile_teamId_key" ON "AppointmentBusinessProfile"("teamId");

-- CreateIndex
CREATE INDEX "AppointmentStaff_teamId_isActive_sortOrder_idx" ON "AppointmentStaff"("teamId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "AppointmentStaff_profileId_idx" ON "AppointmentStaff"("profileId");

-- CreateIndex
CREATE INDEX "AppointmentServiceOffer_teamId_isActive_sortOrder_idx" ON "AppointmentServiceOffer"("teamId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "AppointmentServiceOffer_profileId_idx" ON "AppointmentServiceOffer"("profileId");

-- CreateIndex
CREATE INDEX "AppointmentServiceOffer_staffId_idx" ON "AppointmentServiceOffer"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleCalendarConnection_teamId_key" ON "GoogleCalendarConnection"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleCalendarToken_connectionId_key" ON "GoogleCalendarToken"("connectionId");

-- CreateIndex
CREATE INDEX "Appointment_teamId_startsAt_idx" ON "Appointment"("teamId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_teamId_status_startsAt_idx" ON "Appointment"("teamId", "status", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_conversationId_idx" ON "Appointment"("conversationId");

-- CreateIndex
CREATE INDEX "Appointment_contactId_idx" ON "Appointment"("contactId");

-- CreateIndex
CREATE INDEX "Appointment_googleEventId_idx" ON "Appointment"("googleEventId");

-- CreateIndex
CREATE INDEX "AppointmentReminder_teamId_status_scheduledFor_idx" ON "AppointmentReminder"("teamId", "status", "scheduledFor");

-- CreateIndex
CREATE INDEX "AppointmentReminder_scheduledFor_status_idx" ON "AppointmentReminder"("scheduledFor", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentReminder_appointmentId_kind_key" ON "AppointmentReminder"("appointmentId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "instant_forms_slug_key" ON "instant_forms"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "instant_forms_short_code_key" ON "instant_forms"("short_code");

-- CreateIndex
CREATE INDEX "instant_forms_team_id_status_updated_at_idx" ON "instant_forms"("team_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "instant_forms_team_id_created_at_idx" ON "instant_forms"("team_id", "created_at");

-- CreateIndex
CREATE INDEX "instant_form_versions_form_id_created_at_idx" ON "instant_form_versions"("form_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "instant_form_versions_form_id_version_key" ON "instant_form_versions"("form_id", "version");

-- CreateIndex
CREATE INDEX "instant_form_orders_team_id_submitted_at_idx" ON "instant_form_orders"("team_id", "submitted_at");

-- CreateIndex
CREATE INDEX "instant_form_orders_form_id_submitted_at_idx" ON "instant_form_orders"("form_id", "submitted_at");

-- CreateIndex
CREATE INDEX "instant_form_orders_team_id_status_submitted_at_idx" ON "instant_form_orders"("team_id", "status", "submitted_at");

-- CreateIndex
CREATE INDEX "instant_form_orders_customer_phone_idx" ON "instant_form_orders"("customer_phone");

-- CreateIndex
CREATE UNIQUE INDEX "instant_form_orders_team_id_order_number_key" ON "instant_form_orders"("team_id", "order_number");

-- CreateIndex
CREATE UNIQUE INDEX "sales_partners_email_key" ON "sales_partners"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sales_partners_user_id_key" ON "sales_partners"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_partners_referral_code_key" ON "sales_partners"("referral_code");

-- CreateIndex
CREATE INDEX "sales_partners_status_created_at_idx" ON "sales_partners"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sales_commission_rules_plan_id_key" ON "sales_commission_rules"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_referrals_team_id_key" ON "sales_referrals"("team_id");

-- CreateIndex
CREATE INDEX "sales_referrals_partner_id_created_at_idx" ON "sales_referrals"("partner_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sales_commissions_payment_id_key" ON "sales_commissions"("payment_id");

-- CreateIndex
CREATE INDEX "sales_commissions_partner_id_status_idx" ON "sales_commissions"("partner_id", "status");

-- CreateIndex
CREATE INDEX "sales_commissions_partner_id_created_at_idx" ON "sales_commissions"("partner_id", "created_at");

-- CreateIndex
CREATE INDEX "sales_payout_requests_partner_id_created_at_idx" ON "sales_payout_requests"("partner_id", "created_at");

-- CreateIndex
CREATE INDEX "sales_payout_requests_status_created_at_idx" ON "sales_payout_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "CreativeProject_teamId_updatedAt_idx" ON "CreativeProject"("teamId", "updatedAt");

-- CreateIndex
CREATE INDEX "CreativeProject_userId_createdAt_idx" ON "CreativeProject"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreativeProductProfile_projectId_key" ON "CreativeProductProfile"("projectId");

-- CreateIndex
CREATE INDEX "CreativeProductProfile_teamId_idx" ON "CreativeProductProfile"("teamId");

-- CreateIndex
CREATE INDEX "CreativeProductAsset_teamId_projectId_position_idx" ON "CreativeProductAsset"("teamId", "projectId", "position");

-- CreateIndex
CREATE INDEX "CreativeModelProfile_teamId_createdAt_idx" ON "CreativeModelProfile"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "CreativeScript_teamId_projectId_idx" ON "CreativeScript"("teamId", "projectId");

-- CreateIndex
CREATE INDEX "CreativeScriptScene_scriptId_position_idx" ON "CreativeScriptScene"("scriptId", "position");

-- CreateIndex
CREATE INDEX "CreativeGenerationJob_teamId_status_createdAt_idx" ON "CreativeGenerationJob"("teamId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CreativeGenerationJob_projectId_createdAt_idx" ON "CreativeGenerationJob"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "CreativeGenerationJob_sceneId_idx" ON "CreativeGenerationJob"("sceneId");

-- CreateIndex
CREATE UNIQUE INDEX "CreativeGenerationJob_teamId_idempotencyKey_key" ON "CreativeGenerationJob"("teamId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "CreativeGenerationAsset_teamId_jobId_idx" ON "CreativeGenerationAsset"("teamId", "jobId");

-- CreateIndex
CREATE INDEX "CreativeVideoVersion_teamId_projectId_isCurrent_idx" ON "CreativeVideoVersion"("teamId", "projectId", "isCurrent");

-- CreateIndex
CREATE INDEX "CreativeVideoVersion_parentVersionId_idx" ON "CreativeVideoVersion"("parentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "CreativeVideoVersion_projectId_version_key" ON "CreativeVideoVersion"("projectId", "version");

-- CreateIndex
CREATE INDEX "CreativeEditRequest_teamId_projectId_idx" ON "CreativeEditRequest"("teamId", "projectId");

-- CreateIndex
CREATE INDEX "CreativeVoiceProfile_teamId_createdAt_idx" ON "CreativeVoiceProfile"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "CreativeMusicTrack_teamId_createdAt_idx" ON "CreativeMusicTrack"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "CreativeUsageRecord_teamId_createdAt_idx" ON "CreativeUsageRecord"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "CreativeUsageRecord_jobId_idx" ON "CreativeUsageRecord"("jobId");

-- CreateIndex
CREATE INDEX "CreativeQualityCheck_teamId_jobId_idx" ON "CreativeQualityCheck"("teamId", "jobId");

-- CreateIndex
CREATE UNIQUE INDEX "CreativeBrief_projectId_key" ON "CreativeBrief"("projectId");

-- CreateIndex
CREATE INDEX "CreativeBrief_teamId_idx" ON "CreativeBrief"("teamId");

-- CreateIndex
CREATE INDEX "CreativeConcept_teamId_projectId_position_idx" ON "CreativeConcept"("teamId", "projectId", "position");

-- CreateIndex
CREATE INDEX "CreativeVideoScene_teamId_projectId_order_idx" ON "CreativeVideoScene"("teamId", "projectId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "CreativeContinuityProfile_projectId_key" ON "CreativeContinuityProfile"("projectId");

-- CreateIndex
CREATE INDEX "CreativeContinuityProfile_teamId_idx" ON "CreativeContinuityProfile"("teamId");

-- CreateIndex
CREATE INDEX "CreativeCaptionTrack_teamId_projectId_idx" ON "CreativeCaptionTrack"("teamId", "projectId");

-- CreateIndex
CREATE INDEX "CreativeStudioModelConfig_mediaType_enabled_priority_idx" ON "CreativeStudioModelConfig"("mediaType", "enabled", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "CreativeStudioModelConfig_provider_modelId_mediaType_key" ON "CreativeStudioModelConfig"("provider", "modelId", "mediaType");

-- CreateIndex
CREATE UNIQUE INDEX "official_whatsapp_templates_type_key" ON "official_whatsapp_templates"("type");

-- CreateIndex
CREATE INDEX "subscription_notification_logs_status_created_at_idx" ON "subscription_notification_logs"("status", "created_at");

-- CreateIndex
CREATE INDEX "subscription_notification_logs_user_id_idx" ON "subscription_notification_logs"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_notification_logs_subscription_id_notification_key" ON "subscription_notification_logs"("subscription_id", "notification_type", "scheduled_date");

-- CreateIndex
CREATE INDEX "phone_otp_verifications_phone_purpose_idx" ON "phone_otp_verifications"("phone", "purpose");

-- CreateIndex
CREATE INDEX "phone_otp_verifications_email_purpose_idx" ON "phone_otp_verifications"("email", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "domain_mailboxes_email_key" ON "domain_mailboxes"("email");

-- CreateIndex
CREATE INDEX "domain_mailboxes_is_active_idx" ON "domain_mailboxes"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "domain_mailboxes_local_part_key" ON "domain_mailboxes"("local_part");

-- CreateIndex
CREATE INDEX "domain_mailbox_messages_mailbox_id_folder_created_at_idx" ON "domain_mailbox_messages"("mailbox_id", "folder", "created_at");

-- CreateIndex
CREATE INDEX "domain_mailbox_messages_mailbox_id_seen_idx" ON "domain_mailbox_messages"("mailbox_id", "seen");

-- CreateIndex
CREATE UNIQUE INDEX "domain_mailbox_messages_mailbox_id_resend_email_id_key" ON "domain_mailbox_messages"("mailbox_id", "resend_email_id");

-- CreateIndex
CREATE INDEX "tiktok_adgroups_campaign_id_idx" ON "tiktok_adgroups"("campaign_id");

-- CreateIndex
CREATE INDEX "tiktok_adgroups_team_id_idx" ON "tiktok_adgroups"("team_id");

-- CreateIndex
CREATE INDEX "tiktok_adgroups_user_id_idx" ON "tiktok_adgroups"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tiktok_adgroups_user_id_advertiser_id_adgroup_id_key" ON "tiktok_adgroups"("user_id", "advertiser_id", "adgroup_id");

-- CreateIndex
CREATE INDEX "tiktok_ads_adgroup_id_idx" ON "tiktok_ads"("adgroup_id");

-- CreateIndex
CREATE INDEX "tiktok_ads_team_id_idx" ON "tiktok_ads"("team_id");

-- CreateIndex
CREATE INDEX "tiktok_ads_user_id_idx" ON "tiktok_ads"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tiktok_ads_user_id_advertiser_id_ad_id_key" ON "tiktok_ads"("user_id", "advertiser_id", "ad_id");

-- CreateIndex
CREATE INDEX "tiktok_advertisers_team_id_idx" ON "tiktok_advertisers"("team_id");

-- CreateIndex
CREATE INDEX "tiktok_marketing_advertisers_user_id_idx" ON "tiktok_advertisers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tiktok_marketing_advertisers_user_id_advertiser_id_key" ON "tiktok_advertisers"("user_id", "advertiser_id");

-- CreateIndex
CREATE INDEX "tiktok_api_logs_advertiser_id_idx" ON "tiktok_api_logs"("advertiser_id");

-- CreateIndex
CREATE INDEX "tiktok_api_logs_created_at_idx" ON "tiktok_api_logs"("created_at");

-- CreateIndex
CREATE INDEX "tiktok_api_logs_workspace_id_idx" ON "tiktok_api_logs"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "TikTokTrackingClick_clickToken_key" ON "tiktok_clicks"("clickToken");

-- CreateIndex
CREATE INDEX "TikTokTrackingClick_campaignId_idx" ON "tiktok_clicks"("campaignId");

-- CreateIndex
CREATE INDEX "TikTokTrackingClick_clickToken_idx" ON "tiktok_clicks"("clickToken");

-- CreateIndex
CREATE INDEX "TikTokTrackingClick_teamId_createdAt_idx" ON "tiktok_clicks"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "tiktok_clicks_ttclid_idx" ON "tiktok_clicks"("ttclid");

-- CreateIndex
CREATE INDEX "tiktok_message_event_sets_advertiser_id_idx" ON "tiktok_message_event_sets"("advertiser_id");

-- CreateIndex
CREATE INDEX "tiktok_message_event_sets_workspace_id_idx" ON "tiktok_message_event_sets"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "tiktok_message_event_sets_workspace_id_advertiser_id_whatsapp_n" ON "tiktok_message_event_sets"("workspace_id", "advertiser_id", "whatsapp_number");

-- CreateIndex
CREATE INDEX "tiktok_whatsapp_mappings_lookup_idx" ON "tiktok_whatsapp_mappings"("teamId", "campaign_id", "adgroup_id", "ad_id");

-- CreateIndex
CREATE INDEX "tiktok_whatsapp_mappings_teamId_is_active_idx" ON "tiktok_whatsapp_mappings"("teamId", "is_active");

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_aiAgentId_fkey" FOREIGN KEY ("aiAgentId") REFERENCES "AiAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_whatsAppSessionId_fkey" FOREIGN KEY ("whatsAppSessionId") REFERENCES "WhatsAppSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_whatsAppCloudAccountId_fkey" FOREIGN KEY ("whatsAppCloudAccountId") REFERENCES "WhatsAppCloudAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_telegramConnectionId_fkey" FOREIGN KEY ("telegramConnectionId") REFERENCES "TelegramConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelToken" ADD CONSTRAINT "ChannelToken_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialOAuthSession" ADD CONSTRAINT "SocialOAuthSession_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramConnection" ADD CONSTRAINT "TelegramConnection_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "ai_knowledge_embedding" ADD CONSTRAINT "ai_knowledge_embedding_chunk_id_fkey" FOREIGN KEY ("chunk_id") REFERENCES "AiKnowledgeChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "StoreSettings" ADD CONSTRAINT "StoreSettings_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreCategory" ADD CONSTRAINT "StoreCategory_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreTheme" ADD CONSTRAINT "StoreTheme_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreBanner" ADD CONSTRAINT "StoreBanner_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "StoreCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStockMovement" ADD CONSTRAINT "ProductStockMovement_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStockMovement" ADD CONSTRAINT "ProductStockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStockMovement" ADD CONSTRAINT "ProductStockMovement_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "tiktok_accounts" ADD CONSTRAINT "tiktok_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiktok_login_advertisers" ADD CONSTRAINT "tiktok_login_advertisers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "tiktok_accounts"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiktok_marketing_connections" ADD CONSTRAINT "tiktok_marketing_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiktok_marketing_advertisers" ADD CONSTRAINT "tiktok_marketing_advertisers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "tiktok_marketing_connections"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokAppCredentials" ADD CONSTRAINT "TikTokAppCredentials_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "TikTokCampaign" ADD CONSTRAINT "TikTokCampaign_platformCampaignId_fkey" FOREIGN KEY ("platformCampaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokTrackingClick" ADD CONSTRAINT "TikTokTrackingClick_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokTrackingClick" ADD CONSTRAINT "TikTokTrackingClick_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "TikTokCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokTrackingClick" ADD CONSTRAINT "TikTokTrackingClick_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTokTrackingClick" ADD CONSTRAINT "TikTokTrackingClick_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiktok_integrations" ADD CONSTRAINT "tiktok_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiktok_integrations" ADD CONSTRAINT "tiktok_integrations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiktok_event_configurations" ADD CONSTRAINT "tiktok_event_configurations_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "tiktok_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiktok_integration_clicks" ADD CONSTRAINT "tiktok_integration_clicks_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "tiktok_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiktok_integration_leads" ADD CONSTRAINT "tiktok_integration_leads_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "tiktok_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiktok_integration_leads" ADD CONSTRAINT "tiktok_integration_leads_click_id_fkey" FOREIGN KEY ("click_id") REFERENCES "tiktok_integration_clicks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiktok_integration_conversions" ADD CONSTRAINT "tiktok_integration_conversions_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "tiktok_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiktok_integration_conversions" ADD CONSTRAINT "tiktok_integration_conversions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "tiktok_integration_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiktok_integration_api_logs" ADD CONSTRAINT "tiktok_integration_api_logs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "tiktok_integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiktok_integration_api_logs" ADD CONSTRAINT "tiktok_integration_api_logs_conversion_id_fkey" FOREIGN KEY ("conversion_id") REFERENCES "tiktok_integration_conversions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrafficSource" ADD CONSTRAINT "TrafficSource_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_trafficSourceId_fkey" FOREIGN KEY ("trafficSourceId") REFERENCES "TrafficSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_routingRuleId_fkey" FOREIGN KEY ("routingRuleId") REFERENCES "WhatsAppRoutingRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_aiAgentId_fkey" FOREIGN KEY ("aiAgentId") REFERENCES "AiAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_whatsAppCloudAccountId_fkey" FOREIGN KEY ("whatsAppCloudAccountId") REFERENCES "WhatsAppCloudAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_whatsAppSessionId_fkey" FOREIGN KEY ("whatsAppSessionId") REFERENCES "WhatsAppSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppCloudAccount" ADD CONSTRAINT "WhatsAppCloudAccount_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppCloudAccount" ADD CONSTRAINT "WhatsAppCloudAccount_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppCloudAccount" ADD CONSTRAINT "WhatsAppCloudAccount_aiAgentId_fkey" FOREIGN KEY ("aiAgentId") REFERENCES "AiAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppRoutingRule" ADD CONSTRAINT "WhatsAppRoutingRule_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppRoutingPoolMember" ADD CONSTRAINT "WhatsAppRoutingPoolMember_routingRuleId_fkey" FOREIGN KEY ("routingRuleId") REFERENCES "WhatsAppRoutingRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppRoutingPoolMember" ADD CONSTRAINT "WhatsAppRoutingPoolMember_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "WhatsAppCloudAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedirectLog" ADD CONSTRAINT "RedirectLog_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedirectLog" ADD CONSTRAINT "RedirectLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedirectLog" ADD CONSTRAINT "RedirectLog_resolvedAccountId_fkey" FOREIGN KEY ("resolvedAccountId") REFERENCES "WhatsAppCloudAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationWebhookEvent" ADD CONSTRAINT "IntegrationWebhookEvent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaConnection" ADD CONSTRAINT "MetaConnection_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaConnection" ADD CONSTRAINT "MetaConnection_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaConnection" ADD CONSTRAINT "MetaConnection_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_entitlements" ADD CONSTRAINT "plan_entitlements_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_entitlements" ADD CONSTRAINT "plan_entitlements_feature_key_fkey" FOREIGN KEY ("feature_key") REFERENCES "feature_definitions"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_notifications" ADD CONSTRAINT "admin_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_assistant_conversations" ADD CONSTRAINT "platform_assistant_conversations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_assistant_conversations" ADD CONSTRAINT "platform_assistant_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_assistant_messages" ADD CONSTRAINT "platform_assistant_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "platform_assistant_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_voice_sessions" ADD CONSTRAINT "assistant_voice_sessions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_voice_sessions" ADD CONSTRAINT "assistant_voice_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_voice_sessions" ADD CONSTRAINT "assistant_voice_sessions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "platform_assistant_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_agents" ADD CONSTRAINT "voice_agents_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_phone_numbers" ADD CONSTRAINT "voice_phone_numbers_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_phone_numbers" ADD CONSTRAINT "voice_phone_numbers_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "voice_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_calls" ADD CONSTRAINT "voice_calls_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_calls" ADD CONSTRAINT "voice_calls_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "voice_agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_calls" ADD CONSTRAINT "voice_calls_phone_number_id_fkey" FOREIGN KEY ("phone_number_id") REFERENCES "voice_phone_numbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_transcript_turns" ADD CONSTRAINT "voice_transcript_turns_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "voice_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiktok_event_sets" ADD CONSTRAINT "tiktok_event_sets_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentBusinessProfile" ADD CONSTRAINT "AppointmentBusinessProfile_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentStaff" ADD CONSTRAINT "AppointmentStaff_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentStaff" ADD CONSTRAINT "AppointmentStaff_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AppointmentBusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentServiceOffer" ADD CONSTRAINT "AppointmentServiceOffer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentServiceOffer" ADD CONSTRAINT "AppointmentServiceOffer_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AppointmentBusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentServiceOffer" ADD CONSTRAINT "AppointmentServiceOffer_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "AppointmentStaff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleCalendarConnection" ADD CONSTRAINT "GoogleCalendarConnection_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleCalendarToken" ADD CONSTRAINT "GoogleCalendarToken_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "GoogleCalendarConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "AppointmentStaff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "AppointmentServiceOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentReminder" ADD CONSTRAINT "AppointmentReminder_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentReminder" ADD CONSTRAINT "AppointmentReminder_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instant_forms" ADD CONSTRAINT "instant_forms_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instant_form_versions" ADD CONSTRAINT "instant_form_versions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "instant_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instant_form_orders" ADD CONSTRAINT "instant_form_orders_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instant_form_orders" ADD CONSTRAINT "instant_form_orders_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "instant_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_partners" ADD CONSTRAINT "sales_partners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_commission_rules" ADD CONSTRAINT "sales_commission_rules_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_referrals" ADD CONSTRAINT "sales_referrals_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "sales_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_referrals" ADD CONSTRAINT "sales_referrals_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_referrals" ADD CONSTRAINT "sales_referrals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_commissions" ADD CONSTRAINT "sales_commissions_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "sales_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_commissions" ADD CONSTRAINT "sales_commissions_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "sales_referrals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_commissions" ADD CONSTRAINT "sales_commissions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_commissions" ADD CONSTRAINT "sales_commissions_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_payout_requests" ADD CONSTRAINT "sales_payout_requests_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "sales_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeProject" ADD CONSTRAINT "CreativeProject_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeProject" ADD CONSTRAINT "CreativeProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeProductProfile" ADD CONSTRAINT "CreativeProductProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CreativeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeProductProfile" ADD CONSTRAINT "CreativeProductProfile_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeProductProfile" ADD CONSTRAINT "CreativeProductProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeProductAsset" ADD CONSTRAINT "CreativeProductAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CreativeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeProductAsset" ADD CONSTRAINT "CreativeProductAsset_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeProductAsset" ADD CONSTRAINT "CreativeProductAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeModelProfile" ADD CONSTRAINT "CreativeModelProfile_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeModelProfile" ADD CONSTRAINT "CreativeModelProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeModelProfile" ADD CONSTRAINT "CreativeModelProfile_voiceProfileId_fkey" FOREIGN KEY ("voiceProfileId") REFERENCES "CreativeVoiceProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeScript" ADD CONSTRAINT "CreativeScript_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CreativeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeScript" ADD CONSTRAINT "CreativeScript_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeScript" ADD CONSTRAINT "CreativeScript_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeScriptScene" ADD CONSTRAINT "CreativeScriptScene_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "CreativeScript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeScriptScene" ADD CONSTRAINT "CreativeScriptScene_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeScriptScene" ADD CONSTRAINT "CreativeScriptScene_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeGenerationJob" ADD CONSTRAINT "CreativeGenerationJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CreativeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeGenerationJob" ADD CONSTRAINT "CreativeGenerationJob_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeGenerationJob" ADD CONSTRAINT "CreativeGenerationJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeGenerationJob" ADD CONSTRAINT "CreativeGenerationJob_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "CreativeVideoScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeGenerationAsset" ADD CONSTRAINT "CreativeGenerationAsset_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CreativeGenerationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeGenerationAsset" ADD CONSTRAINT "CreativeGenerationAsset_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeGenerationAsset" ADD CONSTRAINT "CreativeGenerationAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeVideoVersion" ADD CONSTRAINT "CreativeVideoVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CreativeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeVideoVersion" ADD CONSTRAINT "CreativeVideoVersion_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CreativeGenerationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeVideoVersion" ADD CONSTRAINT "CreativeVideoVersion_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "CreativeGenerationAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeVideoVersion" ADD CONSTRAINT "CreativeVideoVersion_parentVersionId_fkey" FOREIGN KEY ("parentVersionId") REFERENCES "CreativeVideoVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeVideoVersion" ADD CONSTRAINT "CreativeVideoVersion_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeVideoVersion" ADD CONSTRAINT "CreativeVideoVersion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeEditRequest" ADD CONSTRAINT "CreativeEditRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CreativeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeEditRequest" ADD CONSTRAINT "CreativeEditRequest_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CreativeGenerationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeEditRequest" ADD CONSTRAINT "CreativeEditRequest_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeEditRequest" ADD CONSTRAINT "CreativeEditRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeVoiceProfile" ADD CONSTRAINT "CreativeVoiceProfile_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeVoiceProfile" ADD CONSTRAINT "CreativeVoiceProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeMusicTrack" ADD CONSTRAINT "CreativeMusicTrack_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeMusicTrack" ADD CONSTRAINT "CreativeMusicTrack_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeUsageRecord" ADD CONSTRAINT "CreativeUsageRecord_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CreativeGenerationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeUsageRecord" ADD CONSTRAINT "CreativeUsageRecord_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeUsageRecord" ADD CONSTRAINT "CreativeUsageRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeQualityCheck" ADD CONSTRAINT "CreativeQualityCheck_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CreativeGenerationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeQualityCheck" ADD CONSTRAINT "CreativeQualityCheck_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeQualityCheck" ADD CONSTRAINT "CreativeQualityCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeBrief" ADD CONSTRAINT "CreativeBrief_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CreativeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeBrief" ADD CONSTRAINT "CreativeBrief_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeBrief" ADD CONSTRAINT "CreativeBrief_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeConcept" ADD CONSTRAINT "CreativeConcept_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CreativeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeConcept" ADD CONSTRAINT "CreativeConcept_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeConcept" ADD CONSTRAINT "CreativeConcept_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeVideoScene" ADD CONSTRAINT "CreativeVideoScene_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CreativeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeVideoScene" ADD CONSTRAINT "CreativeVideoScene_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeVideoScene" ADD CONSTRAINT "CreativeVideoScene_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeVideoScene" ADD CONSTRAINT "CreativeVideoScene_musicTrackId_fkey" FOREIGN KEY ("musicTrackId") REFERENCES "CreativeMusicTrack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeVideoScene" ADD CONSTRAINT "CreativeVideoScene_generationJobId_fkey" FOREIGN KEY ("generationJobId") REFERENCES "CreativeGenerationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeContinuityProfile" ADD CONSTRAINT "CreativeContinuityProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CreativeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeContinuityProfile" ADD CONSTRAINT "CreativeContinuityProfile_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeContinuityProfile" ADD CONSTRAINT "CreativeContinuityProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeCaptionTrack" ADD CONSTRAINT "CreativeCaptionTrack_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CreativeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeCaptionTrack" ADD CONSTRAINT "CreativeCaptionTrack_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "CreativeVideoScene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeCaptionTrack" ADD CONSTRAINT "CreativeCaptionTrack_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeCaptionTrack" ADD CONSTRAINT "CreativeCaptionTrack_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_notification_logs" ADD CONSTRAINT "subscription_notification_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_otp_verifications" ADD CONSTRAINT "phone_otp_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domain_mailbox_messages" ADD CONSTRAINT "domain_mailbox_messages_mailbox_id_fkey" FOREIGN KEY ("mailbox_id") REFERENCES "domain_mailboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

