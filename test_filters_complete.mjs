import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Quick setup: register, upload, save
    console.log('📍 Setting up test account with collection...');
    await page.goto('http://localhost:3000/register', { waitUntil: 'networkidle' });
    
    const ts = Date.now();
    const user = `t${ts}`;
    
    // Register
    await page.fill('input[placeholder="Username"]', user);
    await page.fill('input[placeholder="Email"]', `${user}@test.com`);
    await page.fill('input[placeholder*="Password"]', 'Test1234');
    await page.fill('input[placeholder="Confirm password"]', 'Test1234');
    await page.click('button:has-text("Create account")');
    
    await page.waitForTimeout(1500);
    
    // Go to settings
    await page.goto('http://localhost:3000/settings');
    await page.waitForTimeout(1500);
    
    // Upload CSV
    console.log('📍 Uploading collection...');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('/Users/mcg/Desktop/Collection from MTGA.csv');
    
    await page.waitForTimeout(2000);
    
    // Click Save collection button
    console.log('📍 Saving collection...');
    const saveBtn = page.locator('button:has-text("Save collection")');
    await saveBtn.click();
    
    await page.waitForTimeout(2000);
    
    // Go back to home
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    
    console.log('✅ Setup complete');
    
    // Now test filters
    await page.screenshot({ path: '/tmp/test_collection_loaded.png' });
    
    const collTab = page.locator('button:has-text("My Collection")');
    if (await collTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('✅ Collection tab visible');
      await collTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: '/tmp/test_collection_tab.png' });
      
      // Find filter buttons
      const buttons = page.locator('button[title]').filter({ hasText: /^[WUBRG C M]$/ });
      const n = await buttons.count();
      console.log(`Found ${n} color filter buttons`);
      
      if (n > 0) {
        // Get initial card count
        const imgs = page.locator('img[alt]');
        const before = await imgs.count();
        console.log(`📊 Cards before filter: ${before}`);
        
        // Click first color filter
        const title = await buttons.first().getAttribute('title');
        console.log(`📍 Clicking "${title}" filter...`);
        await buttons.first().click();
        await page.waitForTimeout(800);
        
        const after = await imgs.count();
        console.log(`📊 Cards after filter: ${after}`);
        
        if (after < before) {
          console.log('✅ FILTERS WORKING - card count decreased');
        } else if (after === before && before > 0) {
          console.log('❌ FILTERS NOT WORKING - count unchanged');
        } else {
          console.log('⚠️ Cannot verify - issues with card display');
        }
        
        await page.screenshot({ path: '/tmp/test_filters_result.png' });
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
