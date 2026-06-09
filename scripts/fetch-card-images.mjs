import Database from 'better-sqlite3';
import fetch from 'node-fetch';

const db = new Database('./dev.db');
const userId = '14dfda1e-0616-44b9-b013-37f8f51251d2';

// Get cards without images
const missingCards = db.prepare(`
  SELECT DISTINCT name FROM inventory_items
  WHERE userId = ? AND (primaryImageUrl IS NULL OR primaryImageUrl = '')
  ORDER BY name
`).all(userId);

console.log(`Fetching images for ${missingCards.length} cards...`);

let updated = 0;
let failed = 0;

async function fetchAndUpdate(cardName, index) {
  try {
    const res = await fetch(`https://api.scryfall.com/cards/search?q="${encodeURIComponent(cardName)}"`);
    if (!res.ok) throw new Error(`Status ${res.status}`);

    const data = await res.json();
    if (data.data?.length > 0) {
      const card = data.data[0];
      const imageUrl = card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small;

      if (imageUrl) {
        db.prepare(`
          UPDATE inventory_items
          SET primaryImageUrl = ?
          WHERE name = ? AND userId = ?
        `).run(imageUrl, cardName, userId);
        updated++;
      }
    }
  } catch (err) {
    failed++;
  }

  if ((index + 1) % 50 === 0) {
    console.log(`Progress: ${index + 1}/${missingCards.length} (${updated} updated, ${failed} failed)`);
  }
}

// Process in series with 100ms delay
(async () => {
  for (let i = 0; i < missingCards.length; i++) {
    await fetchAndUpdate(missingCards[i].name, i);
    await new Promise(r => setTimeout(r, 100));
  }
  console.log(`✓ Done! Updated ${updated} cards, ${failed} failed.`);
  process.exit(0);
})();
