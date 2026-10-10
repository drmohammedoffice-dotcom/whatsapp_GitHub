import { PublicStorefront } from '@/components/store/public-storefront';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export default async function PublicStorePage({ params }: Props) {
  const { slug } = await params;
  return <PublicStorefront slug={slug} mode="shop" />;
}
