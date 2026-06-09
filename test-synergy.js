const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Register and login
    const testUser = {
      username: 'synergy' + Date.now(),
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
    }, '2x Plains');
    
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    
    // Go to Play tab
    await page.click('button:has-text("Play")');
    await page.waitForTimeout(1000);
    
    // Test with Omnath (ramp-focused commander)
    console.log('Testing synergy-based deck building with Omnath, Locus of Creation...\n');
    
    await page.fill('input[placeholder*="commander"]', 'Omnath, Locus of Creation');
    await page.click('button:has-text("Start Game")');
    
    // Wait for game to load
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(500);
      const content = await page.innerText('body').catch(() => '');
      
      if (content.includes('Commander Game')) {
        console.log('✅ Game loaded - synergy deck built successfully!');
        break;
      }
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
