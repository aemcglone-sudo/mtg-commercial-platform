import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    console.log('📍 Step 1: Creating test account...');
    await page.goto('http://localhost:3000/register', { waitUntil: 'networkidle' });
    
    const ts = Math.random().toString(36).slice(2, 8);
    const user = `ftest${ts}`;
    
    await page.fill('input[placeholder="Username"]', user);
    await page.fill('input[placeholder="Email"]', `${user}@test.com`);
    await page.fill('input[placeholder*="Password"]', 'Test1234!!');
    await page.fill('input[placeholder="Confirm password"]', 'Test1234!!');
    await page.click('button:has-text("Create account")');
    
    await page.waitForTimeout(1500);
    console.log('✅ Account created');
    
    // Go to settings and add test collection via DB or file
    console.log('📍 Step 2: Setting up collection...');
    const csvContent = `Name,Set code,Set name,Quantity,Rarity
Lightning Bolt,LEA,Limited Edition Alpha,4,uncommon
Counterspell,LEA,Limited Edition Alpha,3,uncommon
Dark Ritual,LEA,Limited Edition Alpha,4,uncommon
Giant Growth,LEA,Limited Edition Alpha,4,common
Holy Light,LEA,Limited Edition Alpha,2,uncommon
Stone Rain,LEA,Limited Edition Alpha,2,uncommon
Terror,LEA,Limited Edition Alpha,3,uncommon`;
    
    await page.goto('http://localhost:3000/settings');
    await page.waitForTimeout(800);
    
    const textarea = page.locator('textarea');
    if (await textarea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await textarea.fill(csvContent);
      const saveBtn = page.locator('button:has-text("Save collection")');
      await saveBtn.click();
      await page.waitForTimeout(2000);
      console.log('✅ Collection saved');
    }
    
    // Go back to home
    console.log('📍 Step 3: Testing filters...');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    
    await page.screenshot({ path: '/tmp/filter_test_home.png' });
    
    // Check for collection tab
    const collTab = page.locator('button:has-text("My Collection")');
    const hasTab = await collTab.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (!hasTab) {
      console.log('⚠️ Collection tab not visible yet');
      // Try refreshing
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: '/tmp/filter_test_after_reload.png' });
    }
    
    // Click My Collection tab
    const tab = page.locator('button:has-text("My Collection")');
    const visible = await tab.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (visible) {
      await tab.click();
      await page.waitForTimeout(1000);
      console.log('✅ Clicked My Collection tab');
      
      // Take screenshot of collection page
      await page.screenshot({ path: '/tmp/filter_test_collection.png' });
      
      // Look for filter buttons
      const filters = page.locator('button[title]').filter({ hasText: /^[WUBRG C M]$/ });
      const count = await filters.count();
      console.log(`Found ${count} color filter buttons`);
      
      if (count > 0) {
        // Get card count before filter
        const cards = page.locator('img[alt]');
        const before = await cards.count();
        console.log(`📊 Cards before filter: ${before}`);
        
        // Click Red filter
        const redBtn = filters.filter({ hasText: 'R' });
        const found = await redBtn.isVisible({ timeout: 1000 }).catch(() => false);
        
        if (found) {
          console.log('📍 Clicking Red (R) filter...');
          await redBtn.click();
          await page.waitForTimeout(800);
          
          const after = await cards.count();
          console.log(`📊 Cards after Red filter: ${after}`);
          
          await page.screenshot({ path: '/tmp/filter_test_after_click.png' });
          
          // Analyze result
          if (after < before && before > 0) {
            console.log('✅ RESULT: FILTERS ARE WORKING');
            console.log(`   (Card count decreased from ${before} to ${after})`);
          } else if (after === before && before > 0) {
            console.log('❌ RESULT: FILTERS ARE NOT WORKING');
            console.log(`   (Card count unchanged: ${before})`);
          } else {
            console.log('⚠️ RESULT: Cannot verify');
            console.log(`   (Before: ${before}, After: ${after})`);
          }
        } else {
          console.log('⚠️ Red filter button not found');
        }
      } else {
        console.log('❌ No color filter buttons found');
        // Check if we need to scroll
        const filterSection = page.locator('text="Color"');
        if (await filterSection.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log('⚠️ Filter section visible but buttons not found');
        }
      }
    } else {
      console.log('❌ My Collection tab not visible');
      // Log page content for debugging
      const title = await page.title();
      const url = page.url();
      console.log(`  Current page: ${url}`);
    }
    
  } catch (err) {
    console.error('❌ Test failed:', err.message);
  } finally {
    await browser.close();
  }
})();
