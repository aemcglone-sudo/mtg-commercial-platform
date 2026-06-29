import FindLocally from '@/components/marketplace/FindLocally';

export const metadata = { title: 'Find Card Locally — Grimoire' };

export default async function CardLocalPage({ params }: { params: Promise<{ scryfallId: string }> }) {
  const { scryfallId } = await params;
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-zinc-100 mb-2">Find Locally</h1>
      <p className="text-zinc-500 text-sm mb-8">Local game stores near you with this card in stock.</p>
      <FindLocally initialCard={scryfallId} />
    </div>
  );
}
