#!/usr/bin/env python3
"""Append VPS platform/billing/admin Prisma models if missing."""
from pathlib import Path
import re

SCHEMA = Path('packages/database/prisma/schema.prisma')
if not SCHEMA.exists():
    raise SystemExit('schema.prisma not found')

text = SCHEMA.read_text(encoding='utf-8')
if 'model Subscription ' in text or 'model Subscription\n' in text:
    print('Platform models already present')
    raise SystemExit(0)

BLOCK = r'''
enum AdminNotificationChannel {
  EMAIL
  IN_APP
  BROADCAST
}

enum AdminRole {
  SUPER_ADMIN
  SUPPORT_AGENT
  BILLING_MANAGER
  DEVELOPER
}

enum BillingInterval {
  MONTHLY
  YEARLY
}

enum InvoiceStatus {
  DRAFT
  OPEN
  PAID
  VOID
  UNCOLLECTIBLE
}

enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
}

enum PlatformActivityCategory {
  AUTH
  SUBSCRIPTION
  USER
  INTEGRATION
  ADMIN
  SYSTEM
}

enum SubscriptionStatus {
  TRIAL
  ACTIVE
  PAUSED
  CANCELLED
  EXPIRED
  PENDING
}

enum SupportTicketPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum SupportTicketStatus {
  OPEN
  PENDING
  CLOSED
}

model AdminUser {
  id             String          @id @default(cuid())
  userId         String          @unique @map("user_id")
  role           AdminRole       @default(SUPPORT_AGENT)
  isActive       Boolean         @default(true) @map("is_active")
  createdAt      DateTime        @default(now()) @map("created_at")
  updatedAt      DateTime        @updatedAt @map("updated_at")
  user           User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  auditLogs      PlatformAuditLog[]
  assignedTickets SupportTicket[] @relation("TicketAssignee")
  ticketMessages TicketMessage[]

  @@map("admin_users")
}

model SubscriptionPlan {
  id            String         @id @default(cuid())
  slug          String         @unique
  name          String
  description   String?
  priceCents    Int            @map("price_cents")
  currency      String         @default("USD")
  interval      BillingInterval  @default(MONTHLY)
  trialDays     Int            @default(14) @map("trial_days")
  features      Json?
  isActive      Boolean        @default(true) @map("is_active")
  sortOrder     Int            @default(0) @map("sort_order")
  createdAt     DateTime       @default(now()) @map("created_at")
  updatedAt     DateTime       @updatedAt @map("updated_at")
  subscriptions Subscription[]

  @@map("subscription_plans")
}

model Subscription {
  id                 String             @id @default(cuid())
  teamId             String             @unique @map("team_id")
  planId             String             @map("plan_id")
  ownerUserId        String?            @map("owner_user_id")
  status             SubscriptionStatus @default(TRIAL)
  trialEndsAt        DateTime?          @map("trial_ends_at")
  currentPeriodStart DateTime?          @map("current_period_start")
  currentPeriodEnd   DateTime?          @map("current_period_end")
  cancelledAt        DateTime?          @map("cancelled_at")
  pausedAt           DateTime?          @map("paused_at")
  mrrCents           Int                @default(0) @map("mrr_cents")
  billingCycle       BillingInterval    @default(MONTHLY) @map("billing_cycle")
  metadata           Json?
  createdAt          DateTime           @default(now()) @map("created_at")
  updatedAt          DateTime           @updatedAt @map("updated_at")
  team               Team               @relation(fields: [teamId], references: [id], onDelete: Cascade)
  plan               SubscriptionPlan   @relation(fields: [planId], references: [id])
  owner              User?              @relation(fields: [ownerUserId], references: [id])
  invoices           Invoice[]
  payments           Payment[]

  @@index([planId])
  @@index([status])
  @@map("subscriptions")
}

model Payment {
  id             String        @id @default(cuid())
  subscriptionId String        @map("subscription_id")
  teamId         String        @map("team_id")
  amountCents    Int           @map("amount_cents")
  currency       String        @default("USD")
  status         PaymentStatus @default(PENDING)
  provider       String?
  providerRef    String?       @map("provider_ref")
  description    String?
  metadata       Json?
  paidAt         DateTime?     @map("paid_at")
  createdAt      DateTime      @default(now()) @map("created_at")
  subscription   Subscription  @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)

  @@index([subscriptionId])
  @@index([teamId, createdAt])
  @@map("payments")
}

model Invoice {
  id             String        @id @default(cuid())
  subscriptionId String        @map("subscription_id")
  teamId         String        @map("team_id")
  number         String        @unique
  amountCents    Int           @map("amount_cents")
  currency       String        @default("USD")
  status         InvoiceStatus @default(DRAFT)
  dueAt          DateTime?     @map("due_at")
  paidAt         DateTime?     @map("paid_at")
  lineItems      Json?         @map("line_items")
  metadata       Json?
  createdAt      DateTime      @default(now()) @map("created_at")
  updatedAt      DateTime      @updatedAt @map("updated_at")
  subscription   Subscription  @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)

  @@index([teamId, createdAt])
  @@map("invoices")
}

model PlatformAuditLog {
  id          String     @id @default(cuid())
  adminUserId String?    @map("admin_user_id")
  action      String
  resource    String
  resourceId  String?    @map("resource_id")
  metadata    Json?
  ipAddress   String?    @map("ip_address")
  userAgent   String?    @map("user_agent")
  createdAt   DateTime   @default(now()) @map("created_at")
  adminUser   AdminUser? @relation(fields: [adminUserId], references: [id])

  @@index([adminUserId])
  @@index([createdAt])
  @@map("audit_logs")
}

model PlatformActivityLog {
  id         String                   @id @default(cuid())
  userId     String?                  @map("user_id")
  teamId     String?                  @map("team_id")
  category   PlatformActivityCategory
  action     String
  resource   String?
  resourceId String?                  @map("resource_id")
  metadata   Json?
  ipAddress  String?                  @map("ip_address")
  userAgent  String?                  @map("user_agent")
  createdAt  DateTime                 @default(now()) @map("created_at")
  user       User?                    @relation(fields: [userId], references: [id])

  @@index([category, createdAt])
  @@index([teamId, createdAt])
  @@index([userId, createdAt])
  @@map("activity_logs")
}

model PlatformNotification {
  id        String                   @id @default(cuid())
  userId    String?                  @map("user_id")
  title     String
  body      String
  channel   AdminNotificationChannel
  sentAt    DateTime?                @map("sent_at")
  readAt    DateTime?                @map("read_at")
  metadata  Json?
  createdAt DateTime                 @default(now()) @map("created_at")
  user      User?                    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@map("admin_notifications")
}

model SystemSetting {
  id        String   @id @default(cuid())
  key       String   @unique
  value     Json
  category  String   @default("general")
  updatedAt DateTime @updatedAt @map("updated_at")
  createdAt DateTime @default(now()) @map("created_at")

  @@index([category])
  @@map("system_settings")
}

model SupportTicket {
  id         String                @id @default(cuid())
  teamId     String?               @map("team_id")
  userId     String?               @map("user_id")
  assigneeId String?               @map("assignee_id")
  subject    String
  status     SupportTicketStatus   @default(OPEN)
  priority   SupportTicketPriority @default(MEDIUM)
  closedAt   DateTime?             @map("closed_at")
  createdAt  DateTime              @default(now()) @map("created_at")
  updatedAt  DateTime              @updatedAt @map("updated_at")
  team       Team?                 @relation(fields: [teamId], references: [id])
  user       User?                 @relation(fields: [userId], references: [id])
  assignee   AdminUser?            @relation("TicketAssignee", fields: [assigneeId], references: [id])
  messages   TicketMessage[]

  @@index([status, createdAt])
  @@index([teamId])
  @@index([userId])
  @@map("support_tickets")
}

model TicketMessage {
  id         String        @id @default(cuid())
  ticketId   String        @map("ticket_id")
  authorId   String?       @map("author_id")
  body       String
  isInternal Boolean       @default(false) @map("is_internal")
  createdAt  DateTime      @default(now()) @map("created_at")
  ticket     SupportTicket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  author     AdminUser?    @relation(fields: [authorId], references: [id])

  @@index([ticketId, createdAt])
  @@map("ticket_messages")
}

model TikTokEventSet {
  id             String   @id @default(cuid())
  workspaceId    String   @map("workspace_id")
  advertiserId   String   @map("advertiser_id")
  whatsappNumber String   @map("whatsapp_number")
  eventSetId     String?  @map("event_set_id")
  eventSetName   String?  @map("event_set_name")
  status         String   @default("PENDING")
  message        String?
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")
  team           Team     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, advertiserId, whatsappNumber])
  @@index([workspaceId])
  @@map("tiktok_event_sets")
}

model TikTokMarketingCampaign {
  id           String   @id @default(cuid())
  userId       String   @map("user_id")
  teamId       String?  @map("team_id")
  advertiserId String   @map("advertiser_id")
  campaignId   String   @map("campaign_id")
  name         String?
  status       String?
  budget       Float?
  objective    String?
  spend        Float    @default(0)
  impressions  Int      @default(0)
  clicks       Int      @default(0)
  cpc          Float    @default(0)
  cpm          Float    @default(0)
  conversions  Int      @default(0)
  raw          Json?
  syncedAt     DateTime @default(now()) @map("synced_at")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@index([advertiserId])
  @@index([teamId])
  @@map("tiktok_campaigns")
}
'''

text = text.rstrip() + '\n' + BLOCK + '\n'

if 'adminProfile AdminUser?' not in text:
    text = text.replace(
        'tikTokIntegrations TikTokIntegration[]',
        'tikTokIntegrations TikTokIntegration[]\n  adminProfile AdminUser?\n  ownedSubscriptions Subscription[]\n  platformActivityLogs PlatformActivityLog[]\n  platformNotifications PlatformNotification[]\n  supportTickets SupportTicket[]',
        1,
    )

if 'suspendedAt' not in text:
    text = text.replace(
        'emailVerifiedAt     DateTime?',
        'emailVerifiedAt     DateTime?\n  suspendedAt           DateTime?',
        1,
    )

if 'tikTokEventSets TikTokEventSet[]' not in text:
    if 'metaConnections MetaConnection[]' in text:
        text = text.replace(
            'metaConnections MetaConnection[]',
            'metaConnections MetaConnection[]\n  subscriptions Subscription[]\n  supportTickets SupportTicket[]\n  tikTokEventSets TikTokEventSet[]',
            1,
        )
    else:
        text = re.sub(
            r'(model Team \{.*?)(\n\})',
            r'\1\n  subscriptions Subscription[]\n  supportTickets SupportTicket[]\n  tikTokEventSets TikTokEventSet[]\2',
            text,
            count=1,
            flags=re.DOTALL,
        )

SCHEMA.write_text(text, encoding='utf-8')
print('Merged VPS platform/billing models into schema.prisma')
