import { redirect } from 'next/navigation';

/** Legacy social integrations hub — consolidated under Settings → Integrations */
export default function IntegrationsRedirectPage() {
  redirect('/settings/integrations');
}
