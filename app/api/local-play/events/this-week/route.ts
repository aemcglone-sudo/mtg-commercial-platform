import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const radius = searchParams.get('radius') ?? '50';

  if (!lat || !lng) return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });

  // Delegate to /api/local-play/events with days_ahead=7
  const url = new URL('/api/local-play/events', req.url);
  url.searchParams.set('lat', lat);
  url.searchParams.set('lng', lng);
  url.searchParams.set('radius', radius);
  url.searchParams.set('days_ahead', '7');

  return fetch(url.toString(), { headers: req.headers });
}
