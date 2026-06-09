const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Register and login
    const testUser = {
      username: 'cmdtest' + Date.now(),
      email: 'test' + Date.now() + '@test.com',
      password: 'testpass123'
    };
    
    await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="text"]', testUser.username);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button:has-text("Sign in")');
    await page.waitForURL('http://localhost:3000');
    
    // Save collection and reload
    await page.evaluate(async (text) => {
      await fetch('/api/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
    }, '1x Plains\n1x Island\n1x Omnath, Locus of Creation');
    
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Go to Play tab
    await page.click('button:has-text("Play")');
    await page.waitForTimeout(1000);
    
    // Start game
    await page.fill('input[placeholder*="commander"]', 'Omnath');
    await page.click('button:has-text("Start Game")');
    
    // Wait longer for Scryfall API calls to complete
    console.log('Waiting for game initialization...');
    await page.waitForTimeout(5000);
    
    // Take screenshot of game board
    await page.screenshot({ path: '/tmp/game-board-full.png' });
    console.log('✅ Game board screenshot saved');
    
    // Check for card images
    const images = await page.locator('img').all();
    console.log('Found', images.length, 'images on game board');
    
    // Get text content to verify game UI
    const text = await page.innerText('body');
    const hasCommander = text.includes('Commander Game');
    const hasLife = text.match(/\b40\b/) ? true : false;
    const hasHand = text.includes('Hand');
    const hasLibrary = text.includes('Library');
    
    console.log('Game elements present:');
    console.log('  "Commander Game" title:', hasCommander ? '✅' : '❌');
    console.log('  Life total (40):', hasLife ? '✅' : '❌');
    console.log('  Hand section:', hasHand ? '✅' : '❌');
    console.log('  Library section:', hasLibrary ? '✅' : '❌');
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
