import { redirect } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type Props = {
  params: Promise<{ workspaceId: string; campaignId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TrackingRedirectPage({ params, searchParams }: Props) {
  const { workspaceId, campaignId } = await params;
  const query = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string') qs.set(key, value);
    else if (Array.isArray(value)) value.forEach((v) => qs.append(key, v));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  redirect(`${API_URL}/api/v1/t/${workspaceId}/${campaignId}${suffix}`);
}
