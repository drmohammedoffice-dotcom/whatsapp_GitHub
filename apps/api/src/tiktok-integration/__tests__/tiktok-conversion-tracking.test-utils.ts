import { MessageType } from '@watsapp/database';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../../security/encryption.service';
import { TikTokEventsApiCredentialsService } from '../tiktok-events-api-credentials.service';
import { TikTokIntegrationTrackingService } from '../tiktok-integration-tracking.service';
import { TikTokLifecycleEventsService } from '../tiktok-lifecycle-events.service';
import { encodeHiddenTrackingRef } from '../../tiktok/hidden-tracking-ref';

export const TEAM_A = 'team-a';
export const TEAM_B = 'team-b';
export const USER_A = 'user-a';
export const USER_B = 'user-b';
export const PIXEL_A = 'PIXELCODEAAA111';
export const PIXEL_B = 'PIXELCODEBBB222';
export const TOKEN_A = 'events-api-access-token-aaaa-secret-value';
export const TOKEN_B = 'events-api-access-token-bbbb-secret-value';
export const PHONE_BIZ = '966500000001';
export const PHONE_CUST = '966511122233';

export type Store = {
  integrations: Map<string, any>;
  clicks: Map<string, any>;
  leads: Map<string, any>;
  conversions: Map<string, any>;
  channels: Map<string, any>;
  apiLogs: any[];
};

export function createStore(): Store {
  return {
    integrations: new Map(),
    clicks: new Map(),
    leads: new Map(),
    conversions: new Map(),
    channels: new Map(),
    apiLogs: [],
  };
}

function matchesWhere(row: any, where: any): boolean {
  if (!where) return true;
  if (where.AND) return where.AND.every((w: any) => matchesWhere(row, w));
  if (where.OR) return where.OR.some((w: any) => matchesWhere(row, w));
  for (const [key, value] of Object.entries(where)) {
    if (key === 'OR' || key === 'AND') continue;
    if (value == null) {
      if (row[key] != null) return false;
      continue;
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
      if ('in' in value) {
        if (!(value as any).in.includes(row[key])) return false;
      } else if ('not' in value) {
        if (row[key] === (value as any).not) return false;
      } else if ('lt' in value) {
        if (!(row[key] < (value as any).lt)) return false;
      } else if ('lte' in value) {
        if (!(row[key] <= (value as any).lte)) return false;
      } else if ('gte' in value) {
        const rowVal = row[key] instanceof Date ? row[key].getTime() : row[key];
        const cmp = (value as any).gte instanceof Date ? (value as any).gte.getTime() : (value as any).gte;
        if (!(rowVal >= cmp)) return false;
      } else if (key === 'integration') {
        const integration = row.integration ?? null;
        if (!integration || !matchesWhere(integration, value)) return false;
      } else if (key === 'lead') {
        if (value === null) {
          if (row.lead) return false;
        } else if (!row.lead || !matchesWhere(row.lead, value)) return false;
      } else {
        for (const [nestedKey, nestedVal] of Object.entries(value as object)) {
          if (row[key]?.[nestedKey] !== nestedVal && nestedVal !== undefined) {
            // shallow nested equality for simple cases
            if (typeof nestedVal !== 'object') {
              if (row[key] !== nestedVal && row[nestedKey] !== nestedVal) {
                // ignore complex nested filters not used in tests
              }
            }
          }
        }
      }
    } else if (row[key] !== value) {
      return false;
    }
  }
  return true;
}

export function createPrismaMock(store: Store) {
  const prisma: any = {
    tikTokIntegration: {
      findUnique: jest.fn(async ({ where, include }: any) => {
        let row =
          [...store.integrations.values()].find((i) =>
            where.id ? i.id === where.id : i.redirectSlug === where.redirectSlug,
          ) ?? null;
        if (row && include?.eventConfigurations) {
          row = { ...row, eventConfigurations: row.eventConfigurations ?? [] };
        }
        return row;
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        return [...store.integrations.values()].find((i) => matchesWhere(i, where)) ?? null;
      }),
      findMany: jest.fn(async ({ where }: any) => {
        return [...store.integrations.values()].filter((i) => matchesWhere(i, where));
      }),
      update: jest.fn(async ({ where, data, include }: any) => {
        const row = store.integrations.get(where.id);
        Object.assign(row, data, { updatedAt: new Date() });
        if (include?.eventConfigurations) {
          return { ...row, eventConfigurations: row.eventConfigurations ?? [] };
        }
        return row;
      }),
      updateMany: jest.fn(async () => ({ count: 0 })),
    },
    tikTokIntegrationClick: {
      create: jest.fn(async ({ data }: any) => {
        const row = {
          id: data.id ?? `click_${store.clicks.size + 1}`,
          ...data,
          createdAt: new Date(),
          lead: null,
          integration: store.integrations.get(data.integrationId),
        };
        store.clicks.set(row.id, row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: any) => store.clicks.get(where.id) ?? null),
      findMany: jest.fn(async ({ where, orderBy, take, select, include }: any) => {
        let rows = [...store.clicks.values()].filter((c) => {
          if (where.integrationId?.in && !where.integrationId.in.includes(c.integrationId)) return false;
          if (typeof where.integrationId === 'string' && c.integrationId !== where.integrationId) return false;
          if (where.createdAt?.gte && c.createdAt < where.createdAt.gte) return false;
          if (where.ttclid?.not === null && (c.ttclid == null || c.ttclid === '')) return false;
          if (where.integration) {
            const integ = store.integrations.get(c.integrationId);
            if (!integ) return false;
            if (where.integration.teamId && integ.teamId !== where.integration.teamId) return false;
            if (where.integration.wizardCompleted != null && integ.wizardCompleted !== where.integration.wizardCompleted)
              return false;
            if (where.integration.billingSuspended != null && integ.billingSuspended !== where.integration.billingSuspended)
              return false;
            if (where.integration.pixelCode?.not === null && !integ.pixelCode) return false;
            if (where.integration.whatsappNumber?.not === null && !integ.whatsappNumber) return false;
          }
          if (where.OR) {
            const lead = [...store.leads.values()].find((l) => l.clickId === c.id) ?? c.lead ?? null;
            const ok = where.OR.some((clause: any) => {
              if (clause.lead === null) return !lead;
              if (clause.lead) {
                return !lead || lead.convertedAt == null;
              }
              return true;
            });
            if (!ok) return false;
          }
          return true;
        });
        if (orderBy?.createdAt === 'desc') {
          rows = rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        if (take) rows = rows.slice(0, take);
        if (select) {
          return rows.map((row) => {
            const out: any = {};
            for (const k of Object.keys(select)) out[k] = (row as any)[k];
            return out;
          });
        }
        if (include) {
          return rows.map((row) => {
            const integration = store.integrations.get(row.integrationId);
            const lead = [...store.leads.values()].find((l) => l.clickId === row.id) ?? row.lead ?? null;
            return {
              ...row,
              lead,
              integration: integration ? { ...integration, eventConfigurations: [] } : null,
            };
          });
        }
        return rows;
      }),
      findFirst: jest.fn(async ({ where, include, orderBy }: any) => {
        let rows = [...store.clicks.values()].filter((c) => {
          const lead = [...store.leads.values()].find((l) => l.clickId === c.id) ?? c.lead ?? null;
          if (where.id?.not && c.id === where.id.not) return false;
          if (where.id && typeof where.id === 'string' && c.id !== where.id) return false;
          if (where.integrationId?.in && !where.integrationId.in.includes(c.integrationId)) return false;
          if (typeof where.integrationId === 'string' && c.integrationId !== where.integrationId) return false;
          if (where.createdAt?.gte && c.createdAt < where.createdAt.gte) return false;
          if (where.ttclid?.not === null && (c.ttclid == null || c.ttclid === '')) return false;
          if (where.integration) {
            const integ = store.integrations.get(c.integrationId);
            if (!integ) return false;
            if (where.integration.teamId && integ.teamId !== where.integration.teamId) return false;
            if (where.integration.wizardCompleted != null && integ.wizardCompleted !== where.integration.wizardCompleted)
              return false;
            if (where.integration.billingSuspended != null && integ.billingSuspended !== where.integration.billingSuspended)
              return false;
            if (where.integration.pixelCode?.not === null && !integ.pixelCode) return false;
            if (where.integration.whatsappNumber?.not === null && !integ.whatsappNumber) return false;
          }
          if (where.OR) {
            const ok = where.OR.some((clause: any) => {
              if (clause.lead === null) return !lead;
              if (clause.lead) {
                if (!lead) return false;
                if (clause.lead.convertedAt === null && lead.convertedAt != null) return false;
                if (clause.lead.conversationId === null && lead.conversationId != null) return false;
                if (
                  typeof clause.lead.conversationId === 'string' &&
                  lead.conversationId !== clause.lead.conversationId
                )
                  return false;
                if (clause.lead.OR) {
                  return clause.lead.OR.some((sub: any) => {
                    if (sub.conversationId === null) return lead.conversationId == null;
                    if (typeof sub.conversationId === 'string')
                      return lead.conversationId === sub.conversationId;
                    return true;
                  });
                }
                return true;
              }
              return matchesWhere({ ...c, lead }, clause);
            });
            if (!ok) return false;
          }
          return true;
        });
        if (orderBy?.createdAt === 'desc') {
          rows = rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        const row = rows[0] ?? null;
        if (!row) return null;
        const integration = store.integrations.get(row.integrationId);
        const lead = [...store.leads.values()].find((l) => l.clickId === row.id) ?? row.lead;
        return include
          ? { ...row, lead, integration: integration ? { ...integration, eventConfigurations: [] } : null }
          : row;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = store.clicks.get(where.id);
        Object.assign(row, data);
        return row;
      }),
    },
    tikTokIntegrationLead: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.clickId) return [...store.leads.values()].find((l) => l.clickId === where.clickId) ?? null;
        if (where.conversationId)
          return [...store.leads.values()].find((l) => l.conversationId === where.conversationId) ?? null;
        return store.leads.get(where.id) ?? null;
      }),
      findFirst: jest.fn(async ({ where, include, orderBy }: any) => {
        let rows = [...store.leads.values()].filter((l) => {
          if (where.id && l.id !== where.id) return false;
          if (where.conversationId && l.conversationId !== where.conversationId) return false;
          if (where.convertedAt === null && l.convertedAt != null) return false;
          if (where.convertedAt?.not === null && (l.convertedAt == null)) return false;
          if (where.integrationId?.in && !where.integrationId.in.includes(l.integrationId)) return false;
          if (typeof where.integrationId === 'string' && l.integrationId !== where.integrationId) return false;
          if (where.createdAt?.gte && l.createdAt < where.createdAt.gte) return false;
          if (where.integration?.teamId) {
            const integ = store.integrations.get(l.integrationId);
            if (!integ || integ.teamId !== where.integration.teamId) return false;
          }
          if (where.OR) {
            const ok = where.OR.some(
              (clause: any) =>
                (clause.contactId && l.contactId === clause.contactId) ||
                (clause.customerPhone && l.customerPhone === clause.customerPhone),
            );
            if (!ok) return false;
          }
          return true;
        });
        if (orderBy?.createdAt === 'desc') rows = rows.sort((a, b) => b.createdAt - a.createdAt);
        const row = rows[0] ?? null;
        if (!row) return null;
        return include
          ? {
              ...row,
              click: store.clicks.get(row.clickId),
              integration: {
                ...store.integrations.get(row.integrationId),
                eventConfigurations: [],
              },
            }
          : row;
      }),
      create: jest.fn(async ({ data }: any) => {
        const row = {
          id: `lead_${store.leads.size + 1}`,
          conversationId: null,
          contactId: null,
          customerPhone: null,
          convertedAt: null,
          conversionEventId: null,
          createdAt: new Date(),
          ...data,
        };
        store.leads.set(row.id, row);
        const click = store.clicks.get(row.clickId);
        if (click) click.lead = row;
        return row;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = store.leads.get(where.id);
        Object.assign(row, data);
        return row;
      }),
    },
    tikTokIntegrationConversion: {
      findUnique: jest.fn(async ({ where, include }: any) => {
        const row = store.conversions.get(where.id) ?? null;
        if (!row) return null;
        return include?.integration
          ? { ...row, integration: store.integrations.get(row.integrationId) }
          : row;
      }),
      findFirst: jest.fn(async ({ where, include, orderBy, select }: any) => {
        let rows = [...store.conversions.values()].filter((c) => {
          if (where.id && c.id !== where.id) return false;
          if (where.conversationId) {
            if (typeof where.conversationId === 'string') {
              if (c.conversationId !== where.conversationId) return false;
            } else if (typeof where.conversationId.startsWith === 'string') {
              if (!String(c.conversationId ?? '').startsWith(where.conversationId.startsWith)) return false;
            }
          }
          if (where.messageId && c.messageId !== where.messageId) return false;
          if (where.eventName && c.eventName !== where.eventName) return false;
          if (where.integrationId && c.integrationId !== where.integrationId) return false;
          if (where.whatsappPhone && c.whatsappPhone !== where.whatsappPhone) return false;
          if (where.contactSent != null && c.contactSent !== where.contactSent) return false;
          if (where.sentAt?.gte && (!c.sentAt || c.sentAt < where.sentAt.gte)) return false;
          if (where.createdAt?.gte && c.createdAt < where.createdAt.gte) return false;
          if (where.orderId && c.orderId !== where.orderId) return false;
          if (where.integration) {
            const integ = store.integrations.get(c.integrationId);
            if (!integ) return false;
            if (where.integration.teamId && integ.teamId !== where.integration.teamId) return false;
            if (where.integration.billingSuspended === false && integ.billingSuspended) return false;
          }
          return true;
        });
        const orderList = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
        for (const ord of [...orderList].reverse()) {
          if (ord?.sentAt === 'desc')
            rows = rows.sort((a, b) => (b.sentAt?.getTime?.() ?? 0) - (a.sentAt?.getTime?.() ?? 0));
          if (ord?.createdAt === 'desc')
            rows = rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        const row = rows[0] ?? null;
        if (!row) return null;
        if (select) {
          const out: any = {};
          for (const k of Object.keys(select)) out[k] = row[k];
          return out;
        }
        return include?.integration
          ? { ...row, integration: store.integrations.get(row.integrationId) }
          : row;
      }),
      create: jest.fn(async ({ data }: any) => {
        // Simulate unique (integrationId, eventName, conversationId) for Contact
        if (data.conversationId) {
          const exists = [...store.conversions.values()].find(
            (c) =>
              c.integrationId === data.integrationId &&
              c.eventName === data.eventName &&
              c.conversationId === data.conversationId,
          );
          if (exists) {
            const err: any = new Error('Unique constraint failed');
            err.code = 'P2002';
            throw err;
          }
        }
        if (data.messageId) {
          const existsMsg = [...store.conversions.values()].find(
            (c) =>
              c.integrationId === data.integrationId &&
              c.eventName === data.eventName &&
              c.messageId === data.messageId,
          );
          if (existsMsg) {
            const err: any = new Error('Unique constraint failed');
            err.code = 'P2002';
            throw err;
          }
        }
        const row = {
          id: `conv_${store.conversions.size + 1}`,
          retryCount: 0,
          nextRetryAt: null,
          sentAt: null,
          tiktokError: null,
          tiktokResponse: null,
          messageId: data.messageId ?? null,
          createdAt: new Date(),
          ...data,
        };
        store.conversions.set(row.id, row);
        return row;
      }),
      update: jest.fn(async ({ where, data, include }: any) => {
        const row = store.conversions.get(where.id);
        Object.assign(row, data);
        if (include?.integration) {
          return {
            ...row,
            integration: store.integrations.get(row.integrationId),
          };
        }
        return row;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const row = store.conversions.get(where.id);
        if (!row) return { count: 0 };
        if (where.contactSent === false && row.contactSent) return { count: 0 };
        if (where.retryCount?.lt != null && !(row.retryCount < where.retryCount.lt)) return { count: 0 };
        if (where.OR) {
          const ok = where.OR.some((clause: any) => {
            if (clause.tiktokStatus === 'pending') return row.tiktokStatus === 'pending';
            if (clause.tiktokStatus === 'sending') {
              if (row.tiktokStatus !== 'sending') return false;
              if (clause.nextRetryAt?.lte) {
                return !row.nextRetryAt || row.nextRetryAt <= clause.nextRetryAt.lte;
              }
              return true;
            }
            return matchesWhere(row, clause);
          });
          if (!ok) return { count: 0 };
        } else if (where.tiktokStatus) {
          if (typeof where.tiktokStatus === 'string' && row.tiktokStatus !== where.tiktokStatus) return { count: 0 };
          if (where.tiktokStatus?.in && !where.tiktokStatus.in.includes(row.tiktokStatus)) return { count: 0 };
        }
        Object.assign(row, data);
        return { count: 1 };
      }),
      count: jest.fn(async ({ where }: any) => {
        return [...store.conversions.values()].filter((c) => matchesWhere(c, where)).length;
      }),
    },
    tikTokIntegrationApiLog: {
      create: jest.fn(async ({ data }: any) => {
        store.apiLogs.push(data);
        return data;
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        return (
          store.apiLogs.find(
            (l) =>
              (!where.eventName || l.eventName === where.eventName) &&
              (!where.eventId || l.eventId === where.eventId) &&
              (where.success == null || l.success === where.success),
          ) ?? null
        );
      }),
    },
    tikTokIntegrationInboundDiag: {
      create: jest.fn(async ({ data }: any) => data),
      findMany: jest.fn(async () => []),
    },
    channel: {
      findFirst: jest.fn(async ({ where, include }: any) => {
        const row = [...store.channels.values()].find(
          (c) => c.id === where.id && c.teamId === where.teamId,
        );
        if (!row) return null;
        return include ? row : row;
      }),
      findMany: jest.fn(async ({ where }: any) => {
        return [...store.channels.values()].filter((c) => {
          if (where.teamId && c.teamId !== where.teamId) return false;
          if (where.purpose && c.purpose !== where.purpose) return false;
          return true;
        });
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = store.channels.get(where.id);
        if (!row) return null;
        Object.assign(row, data);
        return row;
      }),
    },
  };
  return prisma;
}

export function seedWorkspace(
  store: Store,
  opts: {
    teamId: string;
    userId: string;
    pixelCode: string;
    encryptedToken?: string | null;
    slug?: string;
    whatsappNumber?: string;
    defaultOptimizationEvent?: string;
  },
) {
  const id = `integ_${opts.teamId}`;
  const integration = {
    id,
    userId: opts.userId,
    teamId: opts.teamId,
    name: opts.teamId,
    advertiserId: `adv_${opts.teamId}`,
    advertiserName: 'Adv',
    pixelId: `pid_${opts.teamId}`,
    pixelCode: opts.pixelCode,
    pixelName: `Pixel ${opts.teamId}`,
    pixelStatus: 'active',
    encryptedEventsApiAccessToken: opts.encryptedToken ?? null,
    eventsApiTokenHint: opts.encryptedToken ? 'aaaa…zzzz' : null,
    eventsApiConnected: Boolean(opts.encryptedToken),
    eventsApiStatus: opts.encryptedToken ? 'connected' : 'disconnected',
    eventsApiStatusMessage: null,
    lastEventsApiVerificationAt: null,
    lastEventSentAt: null,
    lastEventName: null,
    lastApiHttpStatus: null,
    lastApiError: null,
    whatsappNumber: opts.whatsappNumber ?? PHONE_BIZ,
    redirectSlug: opts.slug ?? `slug-${opts.teamId}`,
    defaultOptimizationEvent: opts.defaultOptimizationEvent ?? 'Contact',
    customEventName: null,
    redirectMessage: 'Hello',
    wizardStep: 6,
    wizardCompleted: true,
    billingSuspended: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    eventConfigurations: [{ eventName: 'Contact', enabled: true }],
  };
  store.integrations.set(id, integration);

  const channelId = `ch_${opts.teamId}`;
  store.channels.set(channelId, {
    id: channelId,
    teamId: opts.teamId,
    purpose: 'TRACKING',
    externalId: `tracking:${opts.whatsappNumber ?? PHONE_BIZ}`,
    metadata: {
      purpose: 'tracking',
      connectionSource: 'tiktok_tracking',
      phoneNumber: opts.whatsappNumber ?? PHONE_BIZ,
      integrationId: id,
    },
    whatsAppSession: {
      id: `sess_${opts.teamId}`,
      purpose: 'TRACKING',
      phoneNumber: opts.whatsappNumber ?? PHONE_BIZ,
      jid: `${opts.whatsappNumber ?? PHONE_BIZ}@s.whatsapp.net`,
      status: 'CONNECTED',
      connectedAt: new Date(),
    },
  });

  return { integration, channelId };
}

export function createTrackingService(deps: {
  prisma: any;
  ads?: any;
  credentials?: any;
  marketingOAuth?: any;
  queue?: any;
}) {
  const config = {
    getOrThrow: (key: string) => {
      if (key === 'WEB_PUBLIC_URL') return 'https://app.test';
      throw new Error(`missing ${key}`);
    },
  } as unknown as ConfigService;

  const billingAccess = { getTeamAccess: jest.fn(async () => ({ isActive: true })) };
  const ads = deps.ads ?? {
    trackPixelEvent: jest.fn(async () => ({ code: 0, message: 'OK' })),
    registerPixelEvents: jest.fn(async () => ({})),
    listPixels: jest.fn(async () => []),
  };
  const marketingOAuth = deps.marketingOAuth ?? {
    getValidMarketingAccessToken: jest.fn(async () => {
      throw new Error('no oauth');
    }),
    forceRefreshMarketingAccessToken: jest.fn(),
  };
  const credentials =
    deps.credentials ??
    ({
      getAccessTokenForIntegration: jest.fn((integ: any) => {
        if (!integ?.encryptedEventsApiAccessToken) return null;
        // test store uses plaintext marker "enc:<token>"
        const raw = String(integ.encryptedEventsApiAccessToken);
        return raw.startsWith('enc:') ? raw.slice(4) : raw;
      }),
      getPlatformCredentials: jest.fn(() => null),
    } as Partial<TikTokEventsApiCredentialsService>);
  const realtime = { emitTeam: jest.fn() };
  const sessionManager = { getSocket: jest.fn(() => null) };
  const queue = deps.queue ?? { add: jest.fn(async () => ({ id: 'job' })) };

  const service = new TikTokIntegrationTrackingService(
    deps.prisma,
    config,
    billingAccess as any,
    ads as any,
    marketingOAuth as any,
    credentials as any,
    realtime as any,
    sessionManager as any,
    queue as any,
  );

  return { service, ads, credentials, queue, billingAccess, realtime, config };
}

export function createLifecycleService(deps: {
  prisma: any;
  ads?: any;
  credentials?: any;
  queue?: any;
}) {
  const config = {
    getOrThrow: () => 'https://app.test',
  } as unknown as ConfigService;
  const ads = deps.ads ?? {
    trackPixelEvent: jest.fn(async () => ({ code: 0, message: 'OK' })),
  };
  const marketingOAuth = {
    getValidMarketingAccessToken: jest.fn(async () => null),
  };
  const credentials =
    deps.credentials ??
    ({
      getAccessTokenForIntegration: jest.fn((integ: any) => {
        const raw = integ?.encryptedEventsApiAccessToken;
        if (!raw) return null;
        return String(raw).startsWith('enc:') ? String(raw).slice(4) : String(raw);
      }),
      getPlatformCredentials: jest.fn(() => ({
        pixelCode: 'PLATFORM_PIXEL',
        accessToken: 'platform-events-access-token-secret',
      })),
    } as any);
  const queue = deps.queue ?? { add: jest.fn(async () => ({ id: 'job' })) };

  const service = new TikTokLifecycleEventsService(
    deps.prisma,
    ads as any,
    marketingOAuth as any,
    credentials as any,
    config,
    queue as any,
  );
  return { service, ads, credentials, queue };
}

export function createCredentialsService(deps: {
  prisma: any;
  ads?: any;
  encryption?: EncryptionService;
}) {
  const encryption =
    deps.encryption ??
    new EncryptionService({
      getOrThrow: () => 'test-encryption-key-32-characters!!',
    } as any);
  const ads = deps.ads ?? {
    trackPixelEvent: jest.fn(async () => ({ code: 0, message: 'OK' })),
    listPixels: jest.fn(async () => []),
  };
  const marketingOAuth = {
    getValidMarketingAccessToken: jest.fn(async () => 'marketing-token'),
  };
  const config = {
    getOrThrow: () => 'https://app.test',
    get: (key: string) => {
      if (key === 'TIKTOK_PLATFORM_PIXEL_CODE') return 'PLATFORM_PIXEL';
      if (key === 'TIKTOK_PLATFORM_EVENTS_ACCESS_TOKEN') return 'platform-events-access-token-secret';
      return undefined;
    },
  } as any;

  const service = new TikTokEventsApiCredentialsService(
    deps.prisma,
    encryption,
    ads as any,
    marketingOAuth as any,
    config,
  );
  return { service, ads, encryption, marketingOAuth };
}

export function inboundInput(
  teamId: string,
  channelId: string,
  conversationId: string,
  opts?: { messageText?: string; phone?: string; messageId?: string; isNewConversation?: boolean },
) {
  return {
    teamId,
    channelId,
    conversationId,
    contactId: `contact_${conversationId}`,
    messageId: opts?.messageId ?? `msg_${conversationId}_${Math.random().toString(36).slice(2, 10)}`,
    senderPhone: opts?.phone ?? PHONE_CUST,
    messageText: opts?.messageText ?? 'Hello',
    messageType: MessageType.TEXT,
    isNewConversation: opts?.isNewConversation ?? true,
  };
}

export { encodeHiddenTrackingRef, MessageType };
