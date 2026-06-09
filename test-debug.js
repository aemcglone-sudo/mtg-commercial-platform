const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Register
    const testUser = {
      username: 'testcmd' + Date.now(),
      email: 'test' + Date.now() + '@test.com',
      password: 'testpassword123'
    };
    
    await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    console.log('✅ User registered');
    
    // Login via browser
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="text"]', testUser.username);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button:has-text("Sign in")');
    await page.waitForURL('http://localhost:3000');
    console.log('✅ Logged in');
    
    // Now save collection via page context (has cookies)
    const saveResult = await page.evaluate(async (text) => {
      const res = await fetch('/api/collection/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json().catch(() => ({ error: res.statusText }));
      return { status: res.status, data };
    }, '1x Plains\n1x Omnath, Locus of Creation');
    
    console.log('Save result:', saveResult);
    
    // Reload and check for content
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    
    const tabsVisible = await page.locator('button:has-text("My Collection")').isVisible({ timeout: 3000 }).catch(() => false);
    console.log('Tabs loaded:', tabsVisible ? '✅' : '❌');
    
    const playTabBtn = await page.locator('button:has-text("Play")').isVisible({ timeout: 2000 }).catch(() => false);
    console.log('Play tab clickable:', playTabBtn ? '✅' : '❌');
    
    if (playTabBtn) {
      await page.click('button:has-text("Play")');
      await page.waitForLoadState('networkidle');
      
      await page.screenshot({ path: '/tmp/play-loaded.png' });
      
      // Check for commander input
      const cmdInput = await page.locator('input[placeholder*="commander"]').isVisible({ timeout: 2000 }).catch(() => false);
      console.log('Commander input visible:', cmdInput ? '✅' : '❌');
      
      if (cmdInput) {
        // Fill and start game
        await page.fill('input[placeholder*="commander"]', 'Omnath');
        await page.click('button:has-text("Start Game")');
        
        await page.waitForTimeout(3000);
        await page.screenshot({ path: '/tmp/game-board.png' });
        
        const gameLoaded = await page.locator('h1:has-text("Commander Game")').isVisible({ timeout: 2000 }).catch(() => false);
        console.log('Game loaded:', gameLoaded ? '✅✅✅ SUCCESS!' : '❌');
      }
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
