/**
 * Cleanup stale events — runs daily (4am ET on Fly.io).
 * Sets is_active=false on:
 *   - One-time events whose date has passed
 *   - Recurring events not confirmed by source in 30 days
 */

import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log('[cleanup-stale-events] Starting...');

  // Deactivate past one-time events
  const { rowCount: pastDeactivated } = await pool.query(
    `UPDATE local_events SET is_active = false, updated_at = NOW()
     WHERE is_recurring = false
       AND specific_date < CURRENT_DATE
       AND is_active = true`
  );
  console.log(`[cleanup] Deactivated ${pastDeactivated} past one-time events`);

  // Flag recurring events not confirmed in 30 days
  const { rowCount: recurringFlagged } = await pool.query(
    `UPDATE local_events SET is_active = false, updated_at = NOW()
     WHERE is_recurring = true
       AND last_confirmed_at < NOW() - INTERVAL '30 days'
       AND is_active = true`
  );
  console.log(`[cleanup] Deactivated ${recurringFlagged} unconfirmed recurring events`);

  console.log('[cleanup-stale-events] Done.');
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
