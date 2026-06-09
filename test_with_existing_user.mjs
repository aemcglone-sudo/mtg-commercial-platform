import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // The glamchowder account exists in the DB, let's manually set the session
    // by directly checking the /api/collection/saved endpoint
    
    console.log('📍 Checking database for existing collections...');
    
    // Let's just navigate to the home page and try using DevTools to check the API
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    
    // Try to fetch the saved collection directly via API
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/collection/saved');
      return await res.json();
    });
    
    console.log('📍 API response:', response);
    
    if (response && response.collectionCards) {
      console.log(`✅ Collection loaded: ${response.collectionCards.length} unique cards`);
      
      // We're logged out, so let's just test with real glamchowder login
      // or try the test approach differently
      await page.goto('http://localhost:3000/login');
      await page.waitForTimeout(1000);
      
      // Try logging in with glamchowder - we need the password though
      // Let's check if there's a bypass or test mode
      
    } else {
      console.log('⚠️ No collection found');
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
