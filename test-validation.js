const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Register and login
    const testUser = {
      username: 'validation' + Date.now(),
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
    }, '2x Plains\n1x Island');
    
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    
    // Test commanders
    const commanders = ['Omnath, Locus of Creation', 'Lightning Bolt', 'Plains'];
    
    for (const cmd of commanders) {
      console.log(`\nTesting commander: "${cmd}"`);
      
      // Go to Play tab
      await page.click('button:has-text("Play")');
      await page.waitForTimeout(1000);
      
      // Try to start game
      await page.fill('input[placeholder*="commander"]', cmd);
      await page.click('button:has-text("Start Game")');
      
      // Wait to see if game loads or error appears
      let result = 'unknown';
      for (let i = 0; i < 15; i++) {
        await page.waitForTimeout(500);
        const content = await page.innerText('body').catch(() => '');
        
        if (content.includes('Commander Game')) {
          result = '✅ Valid commander - game loaded';
          break;
        } else if (content.includes('Could not find') || content.includes('could not')) {
          result = '❌ Invalid commander - rejected';
          break;
        }
      }
      
      console.log(`  Result: ${result}`);
      
      // Go back to Play tab for next test
      if (result === '❌ Invalid commander - rejected') {
        // Click Play tab again
        await page.click('button:has-text("Play")');
        await page.waitForTimeout(1000);
      }
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
