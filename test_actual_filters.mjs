import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  
  try {
    await page.goto('http://localhost:3000/');
    await page.waitForTimeout(2000);
    
    // Look for collection tabs
    const hasCollection = await page.locator('text="My Collection"').isVisible({ timeout: 2000 }).catch(() => false);
    if (!hasCollection) {
      console.log('Not logged in or collection not loaded');
      return;
    }
    
    console.log('✅ Collection loaded');
    
    // Try clicking White color filter
    const whiteBtn = page.locator('button[title="White"]');
    if (await whiteBtn.isVisible({ timeout: 1000 })) {
      console.log('Clicking White filter...');
      await whiteBtn.click();
      await page.waitForTimeout(1000);
      
      const noMatch = await page.locator('text="No cards match"').isVisible({ timeout: 500 }).catch(() => false);
      const cardLinks = await page.locator('a[href*="scryfall"]').count();
      
      if (cardLinks > 0) {
        console.log(`✅ White filter WORKS - showing ${cardLinks} cards`);
      } else if (noMatch) {
        console.log('❌ White filter shows "No cards match"');
      }
    }
    
    if (errors.length > 0) {
      console.log('\nConsole errors:');
      errors.forEach(e => console.log('  ' + e));
    }
    
  } finally {
    await browser.close();
  }
})();
