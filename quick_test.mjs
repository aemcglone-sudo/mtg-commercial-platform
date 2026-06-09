import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Navigate to home (should be logged in if session persists)
    await page.goto('http://localhost:3000/');
    await page.waitForTimeout(2000);
    
    // Check if collection loaded
    const hasCollection = await page.locator('text="My Collection"').isVisible({ timeout: 2000 }).catch(() => false);
    if (!hasCollection) {
      console.log('Not logged in, collection not loaded');
      return;
    }
    
    console.log('✅ Collection loaded');
    
    // Get card count before filter
    const cardsBefore = await page.locator('a').filter({ hasText: /\d+/ }).count();
    console.log(`Cards visible before filter: ${cardsBefore}`);
    
    // Click color R filter
    const rFilter = page.locator('button[title="Red"]');
    const visible = await rFilter.isVisible({ timeout: 1000 }).catch(() => false);
    if (visible) {
      await rFilter.click();
      await page.waitForTimeout(1000);
      
      const cardsAfter = await page.locator('a').filter({ hasText: /\d+/ }).count();
      console.log(`Cards visible after Red filter: ${cardsAfter}`);
      
      const noMatch = await page.locator('text="No cards match"').isVisible({ timeout: 500 }).catch(() => false);
      
      if (cardsAfter > 0) {
        console.log('✅ FILTERS WORKING - cards displayed after clicking Red filter');
      } else if (noMatch) {
        console.log('❌ FILTERS BROKEN - "No cards match" message appeared');
      } else {
        console.log('⚠️ UNCLEAR - no cards or message visible');
      }
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
