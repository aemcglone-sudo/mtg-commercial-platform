const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false }); // Show browser for debugging
  const page = await browser.newPage();
  const viewport = { width: 1280, height: 800 };
  await page.setViewportSize(viewport);
  
  try {
    // Register and login quickly
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
    
    // Save collection
    await page.evaluate(async (text) => {
      await fetch('/api/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
    }, '1x Plains\n1x Island\n1x Omnath, Locus of Creation');
    
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Go to Play and start game
    await page.click('button:has-text("Play")');
    await page.waitForTimeout(1000);
    await page.fill('input[placeholder*="commander"]', 'Omnath');
    await page.click('button:has-text("Start Game")');
    
    console.log('Game started, waiting for initialization...');
    
    // Wait and check content
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(1000);
      const content = await page.innerText('body').catch(() => '');
      
      if (content.includes('Commander Game')) {
        console.log(`✅ Game loaded after ${(i+1) * 1000}ms`);
        console.log('Content preview:', content.substring(0, 200));
        
        // Try screenshot with longer timeout
        try {
          const buffer = await page.screenshot({ timeout: 10000 });
          console.log('✅ Screenshot captured');
        } catch (e) {
          console.log('Screenshot failed:', e.message);
        }
        break;
      }
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    console.log('Leaving browser open for inspection (Ctrl+C to close)');
    // Keep open for 10 seconds
    await page.waitForTimeout(10000);
    await browser.close();
  }
})();
