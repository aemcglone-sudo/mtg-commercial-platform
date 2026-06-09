const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    const testUser = {
      username: 'endpointtest' + Date.now(),
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
    
    console.log('Testing different commander names...');
    
    // Try different names
    const names = ['Omnath, Locus of Creation', 'Plains', 'Island', 'Brainstorm'];
    
    for (const name of names) {
      console.log(`\nTrying "${name}"...`);
      const start = Date.now();
      
      const result = await page.evaluate(async (cmdName) => {
        const res = await fetch('/api/magic-game/generate-deck', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ commanderName: cmdName })
        });
        const data = await res.json();
        return { status: res.status, success: !!data.deck, error: data.error };
      }, name);
      
      const elapsed = Date.now() - start;
      console.log(`  Status: ${result.status}, Success: ${result.success}, Time: ${elapsed}ms`);
      if (result.error) console.log(`  Error: ${result.error}`);
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
