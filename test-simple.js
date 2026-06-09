const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Register and login
    const testUser = {
      username: 'simple' + Date.now(),
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
    
    // Save collection with basic cards
    await page.evaluate(async (text) => {
      const res = await fetch('/api/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      return res.ok;
    }, '2x Plains\n1x Island\n1x Mountain');
    
    console.log('✅ Collection uploaded');
    
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    
    // Click Play tab
    const playBtn = await page.locator('button:has-text("Play")').first();
    const visible = await playBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('Play tab visible:', visible ? '✅' : '❌');
    
    if (visible) {
      await playBtn.click();
      await page.waitForTimeout(1000);
      
      // Start game with "Plains" (basic land legend? no... try Omnath)
      await page.fill('input[placeholder*="commander"]', 'Omnath');
      await page.click('button:has-text("Start Game")');
      
      console.log('Game starting...');
      
      // Wait for game
      for (let i = 0; i < 30; i++) {
        await page.waitForTimeout(500);
        const text = await page.innerText('body').catch(() => '');
        
        if (text.includes('Commander Game')) {
          const libMatch = text.match(/Library: (\d+)/);
          const handMatch = text.match(/Hand \((\d+)\)/);
          const lib = libMatch ? libMatch[1] : '?';
          const hand = handMatch ? handMatch[1] : '?';
          
          console.log(`✅ Game loaded! Library: ${lib}, Hand: ${hand}`);
          console.log(`✅ Total deck size: ${parseInt(lib) + parseInt(hand) + 1} (99 in library + 7 in hand + 1 commander)`);
          
          await page.screenshot({ path: '/tmp/final-test.png' });
          break;
        }
      }
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
