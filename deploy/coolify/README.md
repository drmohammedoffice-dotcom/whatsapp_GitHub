# نشر ChatLoora على Coolify

الملف الأساسي: [`docker-compose.coolify.yml`](../../docker-compose.coolify.yml) في جذر الريبو.

```
Traefik (Coolify + SSL) → gateway (nginx) ─┬─► web  (Next.js)
                                            └─► api  (NestJS) ─► postgres + redis
                                                worker (webhooks)
```

## 1. إنشاء الخدمة في Coolify

1. **Projects → chat-loora-app → production → + New → Docker Compose** (من GitHub App المربوط).
2. Repository: `drmohammedoffice-dotcom/whatsapp_GitHub` — Branch: `main`.
3. Build Pack: **Docker Compose** — Docker Compose Location: `/docker-compose.coolify.yml`.
4. بعد التحميل، في خدمة **gateway** فقط ضع الدومينات (المنفذ 80):
   `https://www.chatloora.com,https://chatloora.com,https://almutamayiziq.com,https://www.almutamayiziq.com`
   باقي الخدمات بدون دومين.
5. فعّل **Auto Deploy** (يكون مفعّلاً افتراضياً مع GitHub App): كل push على `main` ينشر تلقائياً.

## 2. متغيرات البيئة

تُولَّد من ملف `.env` الحالي على السيرفر بالأمر في القسم 4 (لا تكتبها يدوياً).
الإلزامية: `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`,
`API_KEY_PEPPER`, `WEBHOOK_SIGNING_SECRET`.

> ⚠️ `ENCRYPTION_KEY` يجب أن يبقى **نفس القيمة الحالية** وإلا لن تُفك جلسات واتساب ورموز TikTok المحفوظة.

باقي المتغيرات (TikTok, Meta, Wayl, Resend, Google, `USD_TO_IQD_RATE`) تُنسخ كما هي.
`TIKTOK_REDIRECT_URI` و`TIKTOK_BUSINESS_REDIRECT_URI` تبقى على `almutamayiziq.com` لأنها مسجّلة في تطبيق TikTok.

## 3. الملفات المرفوعة

تُخزَّن على السيرفر في `/data/chatloora/storage` (خارج الحاويات) وتُركّب في `api` و`worker` على `/app/storage`.

## 4. خطوات التحويل من PM2/nginx إلى Coolify

> وقت التوقف المتوقع: 10–20 دقيقة. اعمل Snapshot من Contabo قبل البدء.

```bash
# (أ) تجهيز مجلد الملفات ونسخ الملفات الحالية
mkdir -p /data/chatloora/storage
rsync -a /root/whatsapp_GitHub/apps/api/storage/ /data/chatloora/storage/

# (ب) توليد متغيرات Coolify من .env الحالي (يُكتب لملف، لا يُطبع)
#     ثم الصق محتواه في Coolify → Environment Variables → Developer view
```

1. أنشئ الخدمة في Coolify (القسم 1) وأدخل المتغيرات، **ولا تضغط Deploy بعد**.
2. أوقف الكتابة على القاعدة: `pm2 stop api worker web`.
3. خذ نسخة القاعدة: `sudo -u postgres pg_dump -Fc watsapp > /root/backups/cutover.dump`.
4. أوقف nginx: `systemctl stop nginx && systemctl disable nginx`.
5. شغّل Proxy في Coolify: **Servers → localhost → Proxy → Start**.
6. اضغط **Deploy** في Coolify وانتظر بناء الخدمات.
7. استعد القاعدة داخل حاوية postgres:
   ```bash
   C=$(docker ps --format '{{.Names}}' | grep postgres | grep -v coolify | head -1)
   docker cp /root/backups/cutover.dump $C:/tmp/cutover.dump
   docker exec $C sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges --clean --if-exists /tmp/cutover.dump'
   ```
8. أعد تشغيل `api` و`worker` من Coolify، وافتح https://www.chatloora.com وتأكد:
   - تسجيل الدخول، صفحة الحملات، `/api/v1/health/ready`.
   - رابط تتبع بكسل `/r/<slug>` ونموذج `/f/<slug>` ومتجر `/s/<slug>`.
   - الرابط القديم `https://almutamayiziq.com/...` يحوّل لـ chatloora.com.
9. راقب أول دفعة Wayl وأول تحويل TikTok.

### التراجع (Rollback)

إذا فشل شيء: أوقف الخدمة في Coolify، أوقف Proxy، ثم
`systemctl enable --now nginx && pm2 start all` — النظام القديم وقاعدته الأصلية لم يُلمسا.
