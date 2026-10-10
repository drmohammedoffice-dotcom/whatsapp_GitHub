import type { Metadata } from 'next';
import { WhatsAppApiDemoClient, WhatsAppApiDemoPageShell } from '@/components/whatsapp/whatsapp-api-demo';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.chatloora.com';

export const metadata: Metadata = {
  title: 'WhatsApp Cloud API — ChatLoora',
  description:
    'ChatLoora WhatsApp Cloud API messaging demo for Meta App Review (whatsapp_business_messaging). Includes API Setup cURL and in-app send.',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'ChatLoora WhatsApp Cloud API',
    description: 'Send WhatsApp messages via Meta Cloud API from ChatLoora.',
    url: `${baseUrl}/whatsapp-api`,
    type: 'website',
  },
};

export default function WhatsAppApiPage() {
  return (
    <WhatsAppApiDemoPageShell>
      <WhatsAppApiDemoClient />
    </WhatsAppApiDemoPageShell>
  );
}
