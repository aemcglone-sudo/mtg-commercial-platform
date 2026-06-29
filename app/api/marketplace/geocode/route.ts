import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const zip = req.nextUrl.searchParams.get('zip')?.trim();
  if (!zip || !/^\d{5}$/.test(zip)) {
    return NextResponse.json({ error: 'Valid 5-digit zip required' }, { status: 400 });
  }

  const res = await fetch(`https://api.zippopotam.us/us/${zip}`, {
    next: { revalidate: 86400 },
  });
  if (!res.ok) {
    return NextResponse.json({ error: 'Invalid zip code' }, { status: 400 });
  }

  const data = await res.json() as { places: Array<{ latitude: string; longitude: string; 'place name': string; 'state abbreviation': string }> };
  const place = data.places[0];
  return NextResponse.json({
    lat: parseFloat(place.latitude),
    lng: parseFloat(place.longitude),
    city: place['place name'],
    state: place['state abbreviation'],
  });
}
