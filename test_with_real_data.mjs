import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Access the /api/collection/saved endpoint directly to check if data exists
    console.log('Checking for saved collections in database...');
    const response = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/collection/saved');
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    });
    
    // Since we're not logged in, let's just check the DB directly
    console.log('Done');
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
})();
