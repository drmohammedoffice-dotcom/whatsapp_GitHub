import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Alias للإعلانات: /products/ibraq-musk → /store/ibraq-musk مع الحفاظ على ttclid/UTM */
export default async function IbraqMuskAliasPage({ searchParams }: Props) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp || {})) {
    if (value == null) continue;
    if (Array.isArray(value)) value.forEach((v) => qs.append(key, v));
    else qs.set(key, value);
  }
  const query = qs.toString();
  redirect(query ? `/store/ibraq-musk?${query}` : '/store/ibraq-musk');
}
