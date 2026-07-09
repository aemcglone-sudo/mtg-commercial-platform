'use client';

import { useState, useEffect, useCallback } from 'react';
import ProductCard from '@/components/products/ProductCard';

interface Product {
  id: string;
  name: string;
  category: string;
  product_type: string;
  set_code: string | null;
  set_name: string | null;
  msrp_cents: number | null;
  image_url: string | null;
  nearby_count: string;
}

interface CategoryItem { category: string; count: string }

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  sealed: 'Sealed Products',
  accessory: 'Accessories',
};

const CATEGORY_LABELS: Record<string, string> = {
  booster_box: 'Booster Box',
  collector_box: 'Collector Box',
  bundle: 'Bundle',
  commander_precon: 'Commander Precon',
  prerelease_kit: 'Prerelease Kit',
  starter_deck: 'Starter Deck',
  sleeve: 'Sleeves',
  deck_box: 'Deck Box',
  playmat: 'Playmat',
  dice: 'Dice',
  binder: 'Binder',
  storage_box: 'Storage',
  other_sealed: 'Other Sealed',
  other_accessory: 'Other',
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    fetch('/api/products/categories')
      .then(r => r.json())
      .then((d: { categories: CategoryItem[] }) => setCategories(d.categories ?? []))
      .catch(() => {});

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      );
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (typeFilter) params.set('type', typeFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      if (userLocation) {
        params.set('lat', String(userLocation.lat));
        params.set('lng', String(userLocation.lng));
      }
      const res = await fetch(`/api/marketplace/products?${params.toString()}`);
      const data = await res.json() as { products: Product[] };
      setProducts(data.products ?? []);
    } finally {
      setLoading(false);
    }
  }, [q, typeFilter, categoryFilter, userLocation]);

  useEffect(() => { load(); }, [load]);

  const filteredCategories = typeFilter
    ? categories.filter(c => {
        const sealed = ['booster_box','collector_box','bundle','commander_precon','prerelease_kit','starter_deck','jumpstart','secret_lair','prerelease_kit','commander_collection','anthology','other_sealed'];
        const accessory = ['sleeve','deck_box','playmat','binder','storage_box','dice','tokens','other_accessory'];
        return typeFilter === 'sealed' ? sealed.includes(c.category) : accessory.includes(c.category);
      })
    : categories;

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold">Products</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Browse sealed products and accessories from local shops</p>
        </div>

        <div className="flex gap-6">
          {/* Sidebar filters */}
          <aside className="w-48 shrink-0 space-y-5">
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Type</p>
              <div className="space-y-1">
                {[{ value: '', label: 'All' }, ...Object.entries(PRODUCT_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))].map(o => (
                  <button
                    key={o.value}
                    onClick={() => { setTypeFilter(o.value); setCategoryFilter(''); }}
                    className={`block w-full text-left text-sm px-2 py-1 rounded-lg transition-colors ${
                      typeFilter === o.value ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredCategories.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Category</p>
                <div className="space-y-1">
                  <button
                    onClick={() => setCategoryFilter('')}
                    className={`block w-full text-left text-sm px-2 py-1 rounded-lg transition-colors ${
                      !categoryFilter ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    All
                  </button>
                  {filteredCategories.map(c => (
                    <button
                      key={c.category}
                      onClick={() => setCategoryFilter(c.category)}
                      className={`block w-full text-left text-sm px-2 py-1 rounded-lg transition-colors ${
                        categoryFilter === c.category ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {CATEGORY_LABELS[c.category] ?? c.category} <span className="text-zinc-600">({c.count})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-4">
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search products…"
              className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            />

            {loading ? (
              <div className="text-center py-16 text-zinc-500 text-sm">Loading…</div>
            ) : products.length === 0 ? (
              <div className="text-center py-16 text-zinc-400 text-sm">No products found.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {products.map(p => (
                  <ProductCard
                    key={p.id}
                    id={p.id}
                    name={p.name}
                    category={p.category}
                    set_code={p.set_code}
                    set_name={p.set_name}
                    msrp_cents={p.msrp_cents}
                    image_url={p.image_url}
                    nearby_count={parseInt(p.nearby_count)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
