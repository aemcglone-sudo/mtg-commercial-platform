import FindLocally from '@/components/marketplace/FindLocally';

export const metadata = { title: 'Find Locally — Grimoire' };

export default function FindLocallyPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-zinc-100 mb-2">Find Locally</h1>
      <p className="text-zinc-500 text-sm mb-8">Search inventory at nearby local game stores and request holds.</p>
      <FindLocally />
    </div>
  );
}
