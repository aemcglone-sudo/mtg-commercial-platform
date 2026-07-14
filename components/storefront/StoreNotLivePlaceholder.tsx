import Link from 'next/link';

export default function StoreNotLivePlaceholder({ name }: { name: string }) {
 return (
 <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
 <div className="text-center space-y-4 max-w-sm">
 <p className="text-4xl">🏪</p>
 <h1 className="text-xl font-bold text-zinc-100">{name}</h1>
 <p className="text-zinc-500 text-sm">This store's site isn't live yet.</p>
 <Link href="/stores" className="text-emerald-400 hover:text-emerald-300 text-sm underline block">
 ← Browse stores on Grimoire
 </Link>
 </div>
 </div>
 );
}
