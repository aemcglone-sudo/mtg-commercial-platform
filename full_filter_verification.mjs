import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false }); // visible for debugging
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  try {
    console.log('📍 Setup: Create account and save collection');
    
    // Register
    await page.goto('http://localhost:3000/register');
    const ts = Math.random().toString(36).slice(2, 8);
    const user = `verify${ts}`;
    
    await page.fill('input[placeholder="Username"]', user);
    await page.fill('input[placeholder="Email"]', `${user}@test.com`);
    await page.fill('input[placeholder*="Password"]', 'Test1234!!');
    await page.fill('input[placeholder="Confirm password"]', 'Test1234!!');
    await page.click('button:has-text("Create account")');
    await page.waitForTimeout(1500);
    console.log('✅ Account created');
    
    // Save collection
    await page.goto('http://localhost:3000/settings');
    const csvContent = `Name,Set code,Set name,Quantity
Lightning Bolt,LEA,Limited Edition Alpha,4
Counterspell,LEA,Limited Edition Alpha,3
Dark Ritual,LEA,Limited Edition Alpha,4
Giant Growth,LEA,Limited Edition Alpha,4
Holy Light,LEA,Limited Edition Alpha,2
Stone Rain,LEA,Limited Edition Alpha,2
Terror,LEA,Limited Edition Alpha,3`;
    
    const textarea = page.locator('textarea');
    await textarea.fill(csvContent);
    await page.click('button:has-text("Save collection")');
    await page.waitForTimeout(2000);
    console.log('✅ Collection saved');
    
    // Go to home and check for tabs
    console.log('\n📍 Test: Verify collection loads and filters work');
    await page.goto('http://localhost:3000/');
    await page.waitForTimeout(1500);
    
    console.log('Current URL:', page.url());
    
    // Check for collection tab
    const tabs = page.locator('button').filter({ hasText: /My Collection|Find Decks|Ask Claude/ });
    const tabCount = await tabs.count();
    console.log(`Found ${tabCount} tab buttons`);
    
    // Get all button texts
    const allBtns = page.locator('button');
    const btnCount = await allBtns.count();
    console.log(`Total buttons on page: ${btnCount}`);
    
    // Check if collection was loaded
    const uniqueSpan = page.locator('text="unique"');
    const hasUnique = await uniqueSpan.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (hasUnique) {
      console.log('✅ Collection loaded (found "unique" text)');
      
      // Now test filters
      const filterBtns = page.locator('button[title]').filter({ hasText: /^[WUBRG C M]$/ });
      const filterCount = await filterBtns.count();
      console.log(`\n📊 Found ${filterCount} color filters`);
      
      if (filterCount > 0) {
        // Get cards before and after filter
        const cardImages = page.locator('img[alt]');
        let before = 0;
        try {
          before = await cardImages.count({ timeout: 2000 });
        } catch {}
        
        console.log(`Cards before filter: ${before}`);
        
        // Click Red filter
        const redFilter = filterBtns.filter({ hasText: 'R' });
        if (await redFilter.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log('📍 Clicking Red (R) filter...');
          await redFilter.click();
          await page.waitForTimeout(1000);
          
          let after = 0;
          try {
            after = await cardImages.count({ timeout: 2000 });
          } catch {}
          
          console.log(`Cards after filter: ${after}`);
          
          // VERDICT
          console.log('\n=== FILTER TEST RESULT ===');
          if (after < before && before > 0) {
            console.log('✅ PASS: Filters ARE WORKING');
            console.log(`   Card count changed: ${before} → ${after}`);
          } else if (after === before && before > 0) {
            console.log('❌ FAIL: Filters NOT WORKING');
            console.log(`   Card count unchanged: ${before}`);
          } else {
            console.log('⚠️ INCONCLUSIVE');
            console.log(`   Before: ${before}, After: ${after}`);
          }
        }
      } else {
        console.log('❌ No color filter buttons found');
      }
    } else {
      console.log('⚠️ Collection not loaded - looking for what might be on page...');
      const pageText = await page.textContent();
      if (pageText.includes('No collection')) {
        console.log('Found: "No collection" message');
      }
      if (pageText.includes('Loading your collection')) {
        console.log('Found: "Loading your collection" message');
      }
    }
    
    // Take final screenshot
    await page.screenshot({ path: '/tmp/filter_verification_final.png' });
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    await page.screenshot({ path: '/tmp/error_screenshot.png' });
  } finally {
    // Keep browser open for 5 seconds to review
    await page.waitForTimeout(2000);
    await browser.close();
  }
})();
