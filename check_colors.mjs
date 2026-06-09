import Database from 'better-sqlite3';

const db = new Database('./dev.db');
const row = db.prepare(`
  SELECT parsedData FROM collection_uploads 
  WHERE json_extract(parsedData, '$.collectionSize') > 800
  ORDER BY createdAt DESC 
  LIMIT 1
`).get();

if (!row) {
  console.log('No collection found');
  process.exit(1);
}

const data = JSON.parse(row.parsedData);
const cards = data.collectionCards.slice(0, 30);

const colorCounts = {};
cards.forEach(card => {
  const colors = card.colors ? card.colors.join('') : 'None';
  colorCounts[colors] = (colorCounts[colors] || 0) + 1;
});

console.log('First 30 cards color distribution:');
Object.entries(colorCounts).forEach(([color, count]) => {
  console.log(`  ${color || 'Colorless'}: ${count}`);
});

console.log('\nSample cards:');
cards.slice(0, 5).forEach(card => {
  console.log(`  ${card.name}: colors=${JSON.stringify(card.colors)}`);
});
