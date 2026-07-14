import { notFound } from 'next/navigation';
import { getStorefrontData } from '@/lib/storefront';
import TemplateRenderer from '@/components/storefront/TemplateRenderer';
import StoreNotLivePlaceholder from '@/components/storefront/StoreNotLivePlaceholder';

export const dynamic = 'force-dynamic';

export default async function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getStorefrontData(slug);
  if (!data) notFound();
  if (data.shop.siteStatus !== 'published') return <StoreNotLivePlaceholder name={data.shop.name} />;
  return <TemplateRenderer data={data} />;
}
