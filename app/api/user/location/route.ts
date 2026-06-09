import { auth } from '@/lib/auth';
import { findOne, run } from '@/lib/db';

interface LocationPreference {
  address: string;
  saved_at: string;
}

export async function GET(): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json(null);
    }

    const location = await findOne<LocationPreference>(
      'SELECT address, savedAt as saved_at FROM user_location_preferences WHERE userId = ?',
      [session.user.id]
    );

    if (!location) {
      return Response.json(null);
    }

    return Response.json({
      address: location.address,
      savedAt: location.saved_at,
    });
  } catch (error) {
    console.error('Location GET error:', error);
    return Response.json(null);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { address } = await req.json();
    if (!address?.trim()) {
      return Response.json({ error: 'Address is required' }, { status: 400 });
    }

    const cleanAddress = address.trim();
    const now = new Date().toISOString();

    // Upsert: delete old and insert new (works with older SQLite)
    await run('DELETE FROM user_location_preferences WHERE userId = ?', [session.user.id]);
    await run(
      'INSERT INTO user_location_preferences (id, userId, address, savedAt) VALUES (?, ?, ?, ?)',
      [crypto.randomUUID(), session.user.id, cleanAddress, now]
    );

    return Response.json({
      address: cleanAddress,
      savedAt: now,
    });
  } catch (error) {
    console.error('Location POST error:', error);
    return Response.json({ error: 'Failed to save location' }, { status: 500 });
  }
}
