import { Injectable } from '@nestjs/common';
import { EncryptionService } from '../../security/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BaileysCredentialStore {
  constructor(private readonly prisma: PrismaService, private readonly encryption: EncryptionService) {}

  async state(sessionId: string, baileys: Record<string, unknown>) {
    const creds = (await this.get(sessionId, 'creds', baileys)) ?? (baileys.initAuthCreds as () => unknown)();
    return {
      state: {
        creds,
        keys: {
          get: async (type: string, ids: string[]) => {
            const values: Record<string, unknown> = {};
            await Promise.all(
              ids.map(async (id) => {
                const value = await this.get(sessionId, `${type}:${id}`, baileys);
                if (value) values[id] = value;
              }),
            );
            return values;
          },
          set: async (data: Record<string, Record<string, unknown>>) => {
            const writes: Promise<unknown>[] = [];
            for (const [type, entries] of Object.entries(data)) {
              for (const [id, value] of Object.entries(entries)) {
                writes.push(value ? this.set(sessionId, `${type}:${id}`, value, baileys) : this.delete(sessionId, `${type}:${id}`));
              }
            }
            await Promise.all(writes);
          },
        },
      },
      saveCreds: () => this.set(sessionId, 'creds', creds, baileys),
    };
  }

  private async get(sessionId: string, key: string, baileys: Record<string, unknown>) {
    const record = await this.prisma.sessionCredential.findUnique({ where: { sessionId_key: { sessionId, key } } });
    if (!record) return null;
    const serialized = this.encryption.decryptJson<string>(record.value);
    const reviver = (baileys.BufferJSON as { reviver?: (key: string, value: unknown) => unknown } | undefined)?.reviver;
    return JSON.parse(serialized, reviver);
  }

  private async set(sessionId: string, key: string, value: unknown, baileys: Record<string, unknown>) {
    const replacer = (baileys.BufferJSON as { replacer?: (key: string, value: unknown) => unknown } | undefined)?.replacer;
    const serialized = JSON.stringify(value, replacer);
    const encrypted = this.encryption.encryptJson(serialized);
    await this.prisma.sessionCredential.upsert({
      where: { sessionId_key: { sessionId, key } },
      update: { value: encrypted },
      create: { sessionId, key, value: encrypted },
    });
  }

  private delete(sessionId: string, key: string) {
    return this.prisma.sessionCredential.deleteMany({ where: { sessionId, key } });
  }

  purge(sessionId: string) {
    return this.prisma.sessionCredential.deleteMany({ where: { sessionId } });
  }
}
