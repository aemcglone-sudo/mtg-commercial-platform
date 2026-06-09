const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Register and login
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
    
    console.log('Logged in');
    
    // Test the endpoint directly from page context
    const result = await page.evaluate(async () => {
      const res = await fetch('/api/magic-game/generate-deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commanderName: 'Omnath' })
      });
      const data = await res.json();
      return { status: res.status, data };
    });
    
    console.log('Endpoint response:', result.status);
    if (result.data.error) {
      console.log('Error:', result.data.error);
    } else if (result.data.deck) {
      console.log('✅ Deck generated:', result.data.deck.length, 'cards');
      console.log('First card (commander):', result.data.deck[0].name);
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
