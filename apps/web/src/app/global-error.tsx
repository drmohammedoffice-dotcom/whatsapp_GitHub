'use client';

import { useEffect, useState } from 'react';

const RELOAD_GUARD_KEY = 'chatloora:auto-reload-at';
const RELOAD_GUARD_WINDOW_MS = 60_000;

/** Stale-deployment errors: old tab talking to a newer build. A reload fixes them. */
function isStaleDeploymentError(error: Error & { digest?: string }): boolean {
  const text = `${error.name} ${error.message}`;
  return (
    /ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module|Importing a module script failed|Failed to find Server Action|unexpected response was received from the server/i.test(
      text,
    )
  );
}

function tryAutoReload(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0);
    if (Date.now() - last < RELOAD_GUARD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable — reload anyway, worst case the user sees the card.
  }
  window.location.reload();
  return true;
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [autoReloading, setAutoReloading] = useState(false);

  useEffect(() => {
    console.error(error);
    if (isStaleDeploymentError(error) && tryAutoReload()) {
      setAutoReloading(true);
    }
  }, [error]);

  if (autoReloading) {
    return (
      <html lang="ar" dir="rtl">
        <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#fafafa', color: '#111' }}>
          <main
            style={{
              minHeight: '100vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
            }}
          >
            <p style={{ color: '#4b5563' }}>جاري تحديث الصفحة…</p>
          </main>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#fafafa', color: '#111' }}>
        <main
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            style={{
              maxWidth: '480px',
              width: '100%',
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '16px',
              padding: '32px',
              textAlign: 'center',
              boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
            }}
          >
            <h1 style={{ fontSize: '22px', margin: '0 0 12px' }}>حدث خطأ مؤقت</h1>
            <p style={{ margin: '0 0 8px', color: '#4b5563', lineHeight: 1.6 }}>
              واجه المتصفح مشكلة أثناء تحميل الصفحة. غالباً بسبب تحديث جديد للموقع.
            </p>
            <p style={{ margin: '0 0 24px', color: '#6b7280', fontSize: '14px', lineHeight: 1.6 }}>
              A temporary loading error occurred. This usually happens after a site update.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  border: 'none',
                  borderRadius: '10px',
                  background: '#111827',
                  color: '#fff',
                  padding: '10px 18px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                إعادة تحميل الصفحة
              </button>
              <button
                type="button"
                onClick={() => reset()}
                style={{
                  border: '1px solid #d1d5db',
                  borderRadius: '10px',
                  background: '#fff',
                  color: '#111827',
                  padding: '10px 18px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Try again
              </button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
