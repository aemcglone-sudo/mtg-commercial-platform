const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Register and login
    const testUser = {
      username: 'gamefull' + Date.now(),
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
    
    // Save collection
    await page.evaluate(async (text) => {
      await fetch('/api/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
    }, '1x Plains\n1x Omnath, Locus of Creation');
    
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    
    // Go to Play tab
    await page.click('button:has-text("Play")');
    await page.waitForTimeout(1000);
    
    // Start game
    console.log('Starting game with Omnath...');
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
        
        // Take screenshot
        try {
          await page.screenshot({ path: '/tmp/game-final.png', timeout: 5000 });
          console.log('✅ Screenshot saved');
        } catch (e) {
          console.log('Screenshot failed (expected)');
        }
        break;
      }
    }
    
    if (!gameLoaded) {
      console.log('❌ Game did not load after 20 seconds');
      console.log('Page content sample:', (await page.innerText('body')).substring(0, 200));
    } else {
      // Check for key elements
      const hasLife = await page.locator('text=/\\b40\\b/').isVisible({ timeout: 2000 }).catch(() => false);
      const hasHand = await page.locator('text=Hand').isVisible({ timeout: 2000 }).catch(() => false);
      const hasPass = await page.locator('button:has-text("Pass")').isVisible({ timeout: 2000 }).catch(() => false);
      const hasQuan = await page.locator('text=Quan').isVisible({ timeout: 2000 }).catch(() => false);
      
      console.log('\nGame UI elements:');
      console.log('  Life total (40):', hasLife ? '✅' : '❌');
      console.log('  Hand section:', hasHand ? '✅' : '❌');
      console.log('  Pass button:', hasPass ? '✅' : '❌');
      console.log('  Quan opponent:', hasQuan ? '✅' : '❌');
      
      if (hasLife && hasHand && hasPass && hasQuan) {
        console.log('\n✅✅✅ CommanderPlayground fully functional!');
      }
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
