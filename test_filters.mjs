import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Navigate to the app
    console.log('Opening http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    
    // Wait for page content
    await page.waitForTimeout(1000);
    
    // Take screenshot of initial state
    await page.screenshot({ path: '/tmp/filters_initial.png' });
    console.log('✅ Screenshot saved: /tmp/filters_initial.png');
    
    // Check for "My Collection" tab
    const collectionTab = page.locator('button:has-text("My Collection")');
    const tabVisible = await collectionTab.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (tabVisible) {
      console.log('✅ Collection tab found - collection is loaded');
      
      // Get initial visible card count from the summary
      const uniqueCount = await page.locator('span:has-text("unique")').first().textContent();
      console.log('Card summary text:', uniqueCount);
      
      // Look for filter buttons (color filter buttons)
      const colorButtons = page.locator('button[title]').filter({ hasText: /^[WUBRG C M]$/ });
      const count = await colorButtons.count();
      
      if (count > 0) {
        console.log(`✅ Found ${count} color filter buttons`);
        
        // Click the first color filter
        const firstButton = colorButtons.first();
        const buttonTitle = await firstButton.getAttribute('title');
        console.log(`📍 Clicking color filter: ${buttonTitle}`);
        
        await firstButton.click();
        await page.waitForTimeout(800);
        
        // Take screenshot after clicking
        await page.screenshot({ path: '/tmp/filters_after_click.png' });
        console.log('✅ Screenshot saved: /tmp/filters_after_click.png');
        
        // Check if the filter is active (visual indication)
        const isActive = await firstButton.evaluate(el => {
          const classes = el.className;
          return classes.includes('bg-amber-400') || classes.includes('scale-110');
        });
        
        if (isActive) {
          console.log('✅ Filter button appears active (visual feedback works)');
        } else {
          console.log('⚠️ Filter button visual state unclear');
        }
        
        // Try to find filtered cards or no-match message
        const noMatchMsg = page.locator('text="No cards match these filters"');
        const noMatchVisible = await noMatchMsg.isVisible({ timeout: 2000 }).catch(() => false);
        
        if (noMatchVisible) {
          console.log('✅ Filter is working - "No cards match" message appeared');
        } else {
          // Check if cards are visible
          const gridCards = page.locator('[href*="scryfall"]');
          const cardCount = await gridCards.count();
          console.log(`📊 Visible cards after filter: ${cardCount}`);
          console.log('⚠️ Cannot determine if filters are actually filtering cards');
        }
      } else {
        console.log('❌ No color filter buttons found - filters may not be rendered');
      }
    } else {
      console.log('⚠️ Collection tab not visible - checking if collection is loaded...');
      const noCollectionMsg = page.locator('text="No collection yet"');
      const noCollVisible = await noCollectionMsg.isVisible({ timeout: 2000 }).catch(() => false);
      if (noCollVisible) {
        console.log('⚠️ No collection uploaded - cannot test filters without data');
      }
    }
    
  } finally {
    await browser.close();
  }
})();
