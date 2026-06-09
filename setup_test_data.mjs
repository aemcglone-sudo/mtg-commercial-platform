import sqlite3 from 'sqlite3';
import { randomUUID } from 'crypto';

const db = new sqlite3.Database('./dev.db', (err) => {
  if (err) {
    console.error('DB error:', err);
    process.exit(1);
  }
  
  // Create a test user
  const userId = randomUUID();
  const user = {
    id: userId,
    username: 'filtertest',
    email: 'filtertest@example.com',
    passwordHash: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  db.run(
    `INSERT INTO users (id, username, email, passwordHash, createdAt, updatedAt) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [user.id, user.username, user.email, user.passwordHash, user.createdAt, user.updatedAt],
    (err) => {
      if (err && err.message.includes('UNIQUE')) {
        console.log('User already exists');
        db.close();
        return;
      }
      if (err) {
        console.error('Insert error:', err);
        db.close();
        return;
      }
      
      // Create sample collection data
      const sampleCards = [
        { name: 'Lightning Bolt', quantity: 4, colors: ['R'], cmc: 1, rarity: 'uncommon', setName: 'LEA' },
        { name: 'Counterspell', quantity: 3, colors: ['U'], cmc: 2, rarity: 'uncommon', setName: 'LEA' },
        { name: 'Dark Ritual', quantity: 4, colors: ['B'], cmc: 1, rarity: 'uncommon', setName: 'LEA' },
        { name: 'Giant Growth', quantity: 4, colors: ['G'], cmc: 1, rarity: 'common', setName: 'LEA' },
        { name: 'Holy Light', quantity: 2, colors: ['W'], cmc: 3, rarity: 'uncommon', setName: 'LEA' },
        { name: 'Stone Rain', quantity: 2, colors: ['R'], cmc: 3, rarity: 'uncommon', setName: 'LEA' },
        { name: 'Terror', quantity: 3, colors: ['B'], cmc: 2, rarity: 'uncommon', setName: 'LEA' },
      ];
      
      const collectionCards = sampleCards.map(c => ({
        ...c,
        priceUsd: Math.random() * 50,
        imageUrl: `https://api.scryfall.com/cards/search?q="${encodeURIComponent(c.name)}"`,
        scryfallUri: `https://scryfall.com/search?q=!"${encodeURIComponent(c.name)}"`
      }));
      
      const parsedData = JSON.stringify({
        collectionSize: sampleCards.length,
        totalCards: sampleCards.reduce((a, c) => a + c.quantity, 0),
        detectedFormat: 'Vintage',
        collectionCards
      });
      
      db.run(
        `INSERT INTO collection_uploads (id, userId, rawText, detectedFormat, parsedData, createdAt)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [randomUUID(), userId, '', 'Vintage', parsedData],
        (err) => {
          if (err) {
            console.error('Collection insert error:', err);
          } else {
            console.log('✅ Test user and collection created');
            console.log(`User: filtertest`);
            console.log(`Cards: ${sampleCards.length} unique, ${sampleCards.reduce((a, c) => a + c.quantity, 0)} total`);
          }
          db.close();
        }
      );
    }
  );
});
