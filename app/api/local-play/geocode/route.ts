import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const zip = req.nextUrl.searchParams.get('zip')?.trim();
  if (!zip || !/^\d{5}$/.test(zip)) {
    return NextResponse.json({ error: 'Valid 5-digit zip required' }, { status: 400 });
  }

  const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
  if (!res.ok) return NextResponse.json({ error: 'Zip not found' }, { status: 404 });

  const data = await res.json() as {
    'post code': string;
    places: Array<{ 'place name': string; 'state abbreviation': string; latitude: string; longitude: string }>;
  };
  const place = data.places?.[0];
  if (!place) return NextResponse.json({ error: 'No data for zip' }, { status: 404 });

  return NextResponse.json({
    lat: parseFloat(place.latitude),
    lng: parseFloat(place.longitude),
    city: place['place name'],
    state: place['state abbreviation'],
    zip,
  });
}
