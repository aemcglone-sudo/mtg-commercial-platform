import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Navigate to login
    console.log('📍 Opening http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    
    // Fill in login credentials
    console.log('📍 Logging in with test account...');
    await page.fill('input[placeholder="Username or email"]', 'glamchowder');
    await page.fill('input[placeholder="Password"]', 'Test1234');
    await page.click('button:has-text("Sign in")');
    
    // Wait for navigation to complete
    await page.waitForURL('http://localhost:3000/', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2000);
    
    // Take screenshot after login
    await page.screenshot({ path: '/tmp/filters_logged_in.png' });
    console.log('✅ Logged in and navigated');
    
    // Check if collection is loaded
    const collectionTab = page.locator('button:has-text("My Collection")');
    const tabVisible = await collectionTab.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (!tabVisible) {
      console.log('⚠️ Collection tab not visible');
      const currentUrl = page.url();
      console.log('Current URL:', currentUrl);
      return;
    }
    
    console.log('✅ Collection tab is visible');
    
    // Click on My Collection tab
    await collectionTab.click();
    await page.waitForTimeout(1000);
    
    // Take screenshot of collection page
    await page.screenshot({ path: '/tmp/filters_collection_page.png' });
    console.log('✅ Collection page loaded');
    
    // Get initial card count
    const uniqueCountSpan = await page.locator('span:has-text("unique")').first().textContent();
    console.log('Initial card summary:', uniqueCountSpan);
    
    // Find color filter buttons - they should have title attributes like "White", "Blue", etc.
    const colorButtons = page.locator('button[title]').filter({ hasText: /^[WUBRG C M]$/ });
    const filterCount = await colorButtons.count();
    console.log(`Found ${filterCount} color filter buttons`);
    
    if (filterCount === 0) {
      console.log('❌ No color filter buttons found');
      return;
    }
    
    // Get initial grid card count
    const initialCards = await page.locator('img[alt]').count();
    console.log(`Initial grid has ${initialCards} cards`);
    
    // Click the first color filter (White)
    const firstColorBtn = colorButtons.first();
    const colorLabel = await firstColorBtn.getAttribute('title');
    console.log(`📍 Clicking ${colorLabel} filter...`);
    
    await firstColorBtn.click();
    await page.waitForTimeout(800);
    
    // Take screenshot after filter
    await page.screenshot({ path: '/tmp/filters_after_click.png' });
    
    // Check if filter is active
    const isActive = await firstColorBtn.evaluate(el => {
      const classes = el.className;
      return classes.includes('scale-110') || classes.includes('bg-yellow-100');
    });
    
    console.log(isActive ? '✅ Filter button shows active state' : '⚠️ Filter button state unclear');
    
    // Get cards after filter
    const filteredCards = await page.locator('img[alt]').count();
    console.log(`After filter: ${filteredCards} cards visible`);
    
    if (filteredCards < initialCards) {
      console.log('✅ Filter IS WORKING - card count decreased after filtering');
    } else if (filteredCards === initialCards) {
      console.log('❌ Filter NOT WORKING - card count did not change');
    }
    
    // Try clicking another filter to test combining filters
    console.log('📍 Testing multiple filters...');
    const secondBtn = colorButtons.nth(1);
    const secondColor = await secondBtn.getAttribute('title');
    console.log(`Clicking ${secondColor} filter...`);
    await secondBtn.click();
    await page.waitForTimeout(800);
    
    const twoFiltersCards = await page.locator('img[alt]').count();
    console.log(`With 2 filters active: ${twoFiltersCards} cards`);
    
    if (twoFiltersCards <= filteredCards) {
      console.log('✅ Multiple filters work correctly');
    } else {
      console.log('❌ Multiple filters not working as expected');
    }
    
    // Test clearing filters
    console.log('📍 Testing clear filters button...');
    const clearBtn = page.locator('button:has-text("Clear all filters")');
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
      await page.waitForTimeout(800);
      
      const clearedCards = await page.locator('img[alt]').count();
      console.log(`After clearing filters: ${clearedCards} cards`);
      
      if (clearedCards === initialCards) {
        console.log('✅ Clear filters button works correctly');
      } else {
        console.log('⚠️ Card count after clearing differs from initial');
      }
    } else {
      console.log('⚠️ Clear filters button not visible');
    }
    
    await page.screenshot({ path: '/tmp/filters_final.png' });
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await browser.close();
  }
})();
