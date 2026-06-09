const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Register and login
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
    
    await page.goto('http://localhost:3000/login');
    await page.locator('input[type="text"]').first().fill(testUser.username);
    await page.locator('input[type="password"]').first().fill(testUser.password);
    await page.click('button:has-text("Sign in")');
    await page.waitForURL('http://localhost:3000', { timeout: 10000 });
    
    // Save collection
    await fetch('http://localhost:3000/api/collection/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '1x Plains\n1x Omnath, Locus of Creation' })
    });
    
    // Go to home and wait for page to fully load
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Get page content
    const html = await page.content();
    
    // Check for Play button text
    if (html.includes('Play')) {
      console.log('✅ "Play" text found in HTML');
      console.log('Searching for button with "Play"...');
      
      // Find Play button by looking at actual HTML
      const playButtonMatch = html.match(/<button[^>]*>.*?🎮[^<]*Play[^<]*<\/button>/);
      if (playButtonMatch) {
        console.log('✅ Play button HTML found');
      }
    } else {
      console.log('❌ "Play" not found in HTML');
    }
    
    // Check for expected UI elements
    const hasCollectionText = html.includes('My Collection');
    const hasTabBar = html.includes('collection') && html.includes('play');
    
    console.log('Collection tab visible:', hasCollectionText ? '✅' : '❌');
    console.log('Tab structure present:', hasTabBar ? '✅' : '❌');
    
    // Try to access Play tab directly via URL (since it might not be clickable)
    console.log('\nTrying to navigate directly to Play tab via URL manipulation...');
    await page.evaluate(() => {
      // Set the activeTab to 'play' in localStorage
      localStorage.setItem('activeTab', 'play');
    });
    
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: '/tmp/play-tab-direct.png' });
    
    // Now check for CommanderPlayground elements
    const hasCommanderInput = await page.locator('input[placeholder*="commander"]').isVisible({ timeout: 3000 }).catch(() => false);
    console.log('Commander input visible:', hasCommanderInput ? '✅' : '❌');
    
    if (hasCommanderInput) {
      console.log('\n✅✅✅ CommanderPlayground accessible!');
      
      // Test the game flow
      const input = await page.locator('input[placeholder*="commander"]').first();
      await input.fill('Omnath');
      
      const startBtn = await page.locator('button:has-text("Start Game")').first();
      if (await startBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('✅ Start Game button found');
        await startBtn.click();
        
        await page.waitForTimeout(3000);
        await page.screenshot({ path: '/tmp/game-board.png' });
        
        // Check for game UI
        const gameTitle = await page.locator('h1').filter({ hasText: 'Commander Game' }).isVisible({ timeout: 2000 }).catch(() => false);
        if (gameTitle) {
          console.log('✅ Game board loaded');
          
          // Get hand count
          const handText = await page.locator('text=/Hand.*\\(/').first().textContent().catch(() => '');
          console.log('Hand:', handText);
          
          // Take final screenshot
          await page.screenshot({ path: '/tmp/game-playing.png' });
        }
      }
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
