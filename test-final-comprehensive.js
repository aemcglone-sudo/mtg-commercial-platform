const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Register and login
    const testUser = {
      username: 'final' + Date.now(),
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
    console.log('✅ Logged in');
    
    // Save collection
    await page.evaluate(async (text) => {
      await fetch('/api/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
    }, '2x Plains');
    
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    
    // Go to Play tab
    await page.click('button:has-text("Play")');
    await page.waitForTimeout(1000);
    
    // Test with a legendary creature commander
    console.log('Starting game with Omnath, Locus of Creation...');
    const startTime = Date.now();
    
    await page.fill('input[placeholder*="commander"]', 'Omnath, Locus of Creation');
    await page.click('button:has-text("Start Game")');
    
    // Wait for game to load
    let gameLoaded = false;
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(500);
      const content = await page.innerText('body').catch(() => '');
      
      if (content.includes('Commander Game')) {
        gameLoaded = true;
        const elapsed = Date.now() - startTime;
        console.log(`✅ Game loaded in ${elapsed}ms`);
        
        // Extract game state
        const lifeMatch = content.match(/You[\s\S]{0,100}(\d{2})/);
        const libMatch = content.match(/Library: (\d+)/);
        const handMatch = content.match(/Hand \((\d+)\)/);
        
        const life = lifeMatch ? lifeMatch[1] : '?';
        const lib = libMatch ? libMatch[1] : '?';
        const hand = handMatch ? handMatch[1] : '?';
        
        console.log(`✅ Game State:`);
        console.log(`   - Your life: ${life}`);
        console.log(`   - Library: ${lib} cards`);
        console.log(`   - Hand: ${hand} cards`);
        console.log(`   - Total deck: ${parseInt(lib) + parseInt(hand) + 1} cards`);
        
        // Take screenshot
        await page.screenshot({ path: '/tmp/final-game.png', timeout: 5000 });
        console.log('✅ Screenshot captured');
        
        // Test clicking a card in hand
        const handCards = await page.locator('img[title]').all();
        console.log(`✅ Found ${handCards.length} card images in game`);
        
        break;
      }
    }
    
    if (!gameLoaded) {
      console.log('❌ Game did not load');
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
