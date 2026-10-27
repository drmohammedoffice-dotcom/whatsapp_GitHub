// iOS Universal Links (served as JSON without an extension, no redirects).
// APPLE_TEAM_ID: the 10-character Team ID from developer.apple.com → Membership.
export const dynamic = 'force-dynamic';

const BUNDLE_ID = 'com.chatloora.app';

export function GET() {
  const teamId = (process.env.APPLE_TEAM_ID ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(teamId)) {
    return new Response('Not configured', { status: 404 });
  }
  return Response.json(
    {
      applinks: {
        details: [
          {
            appIDs: [`${teamId}.${BUNDLE_ID}`],
            // Public pages stay on the web; everything else opens in the app when installed.
            components: [
              { '/': '/f/*', exclude: true },
              { '/': '/s/*', exclude: true },
              { '/': '/r/*', exclude: true },
              { '/': '/privacy', exclude: true },
              { '/': '/terms', exclude: true },
              { '/': '/*' },
            ],
          },
        ],
      },
      webcredentials: { apps: [`${teamId}.${BUNDLE_ID}`] },
    },
    { headers: { 'cache-control': 'public, max-age=3600' } },
  );
}
