import StoreProfile from '@/components/marketplace/StoreProfile';

export default async function StoreProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <div className="min-h-screen">
      <StoreProfile slug={slug} />
    </div>
  );
}
