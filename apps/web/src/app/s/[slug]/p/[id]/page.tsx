import { PublicStorefront } from '@/components/store/public-storefront';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string; id: string }> };

export default async function PublicProductPage({ params }: Props) {
  const { slug, id } = await params;
  return <PublicStorefront slug={slug} mode="product" productId={id} />;
}
