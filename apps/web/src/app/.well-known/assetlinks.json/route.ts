// Android App Links verification (https://developer.android.com/training/app-links/verify-android-applinks).
// ANDROID_SHA256_CERT_FINGERPRINTS: comma-separated SHA-256 fingerprints — the Play App Signing
// key (Play Console → App integrity) and the EAS upload key (`eas credentials -p android`).
export const dynamic = 'force-dynamic';

const PACKAGE_NAME = 'com.chatloora.app';

export function GET() {
  const fingerprints = (process.env.ANDROID_SHA256_CERT_FINGERPRINTS ?? '')
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter((value) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(value));

  return Response.json(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: { namespace: 'android_app', package_name: PACKAGE_NAME, sha256_cert_fingerprints: fingerprints },
      },
    ],
    { headers: { 'cache-control': 'public, max-age=3600' } },
  );
}
