import { NextResponse, NextRequest } from 'next/server';
import { run } from '@/lib/db';
import { getAuthenticatedUserId } from '@/lib/auth';

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId(req);

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, address, city, state, zipCode, latitude, longitude, formats, phone, website, venueType } = body;

    if (!name || !latitude || !longitude || !city || !state) {
      return NextResponse.json(
        { error: 'Missing required fields: name, address, city, state, latitude, longitude' },
        { status: 400 }
      );
    }

    const id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const formatsJson = JSON.stringify(formats || ['Commander', 'Casual']);
    const eventTypesJson = JSON.stringify([venueType || 'casual']);

    await run(
      `INSERT INTO community_venues (id, name, address, city, state, zipCode, latitude, longitude, formats, eventTypes, phone, website, userRating, reviewCount, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        address || '',
        city,
        state,
        zipCode || '',
        latitude,
        longitude,
        formatsJson,
        eventTypesJson,
        phone || '',
        website || '',
        5, // Start with 5 star rating for user-submitted
        1, // 1 review (the submission)
        new Date().toISOString(),
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Venue submitted! Thanks for contributing to the Magic community.',
      venue: {
        id,
        name,
        city,
        state,
        latitude,
        longitude,
      },
    });
  } catch (err) {
    console.error('Venue submission error:', err);
    return NextResponse.json({ error: 'Failed to submit venue' }, { status: 500 });
  }
}
