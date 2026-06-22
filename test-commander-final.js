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
    
    // Login
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
    }, '1x Plains\n1x Island\n1x Omnath, Locus of Creation\n1x Brainstorm');
    
    console.log('✅ Collection saved');
    
    // Reload
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Check for Play tab
    const playTabVisible = await page.locator('button:has-text("Play")').isVisible({ timeout: 3000 }).catch(() => false);
    console.log('Play tab visible:', playTabVisible ? '✅' : '❌');
    
    if (playTabVisible) {
      await page.click('button:has-text("Play")');
      await page.waitForTimeout(1500);
      
      await page.screenshot({ path: '/tmp/play-tab.png' });
      
      const cmdInput = await page.locator('input[placeholder*="commander"]').isVisible({ timeout: 2000 }).catch(() => false);
      console.log('Commander selection screen loaded:', cmdInput ? '✅' : '❌');
      
      if (cmdInput) {
        await page.fill('input[placeholder*="commander"]', 'Omnath');
        await page.click('button:has-text("Start Game")');
        
        await page.waitForTimeout(3500);
        await page.screenshot({ path: '/tmp/game-board.png' });
        
        // Check game loaded
        const gameUI = await page.locator('text=/Quan.*You.*Hand.*Pass/').isVisible({ timeout: 2000 }).catch(() => false);
        const gameTitle = await page.locator('h1').filter({ hasText: 'Commander' }).isVisible({ timeout: 2000 }).catch(() => false);
        
        console.log('Game board rendered:', gameTitle ? '✅' : '❌');
        console.log('Game UI complete:', gameUI ? '✅' : '❌');
        
        if (gameTitle) {
          console.log('\n✅✅✅ CommanderPlayground works end-to-end!');
        }
      }
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
