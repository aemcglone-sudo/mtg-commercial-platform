import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/session';
import { getStorefrontData } from '@/lib/storefront';
import TemplateRenderer from '@/components/storefront/TemplateRenderer';
import StorePreviewBanner from '@/components/storefront/StorePreviewBanner';

export const dynamic = 'force-dynamic';

export default async function StorefrontPreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  const session = token ? verifySessionToken(token) : null;
  if (!session) redirect('/shop/login');

  const data = await getStorefrontData(slug);
  if (!data) notFound();

  return (
    <>
      <StorePreviewBanner slug={slug} />
      <TemplateRenderer data={data} />
    </>
  );
}
