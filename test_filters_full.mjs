import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Register new account
    console.log('📍 Opening registration page...');
    await page.goto('http://localhost:3000/register', { waitUntil: 'networkidle' });
    
    const timestamp = Date.now();
    const testUsername = `test${timestamp}`;
    const testEmail = `test${timestamp}@example.com`;
    
    console.log(`📍 Creating account: ${testUsername}`);
    await page.fill('input[placeholder="Username"]', testUsername);
    await page.fill('input[placeholder="Email"]', testEmail);
    await page.fill('input[placeholder*="Password"]', 'Test1234');
    await page.fill('input[placeholder="Confirm password"]', 'Test1234');
    
    await page.click('button:has-text("Create account")');
    await page.waitForTimeout(2000);
    
    const currentUrl = page.url();
    console.log(`After registration, URL: ${currentUrl}`);
    
    // If on home page, we might see "No collection yet"
    const noCollectionMsg = await page.locator('text="No collection yet"').isVisible({ timeout: 2000 }).catch(() => false);
    
    if (noCollectionMsg) {
      console.log('✅ Account created - showing "No collection yet"');
      
      // Click Settings button to upload collection
      const settingsBtn = page.locator('a:has-text("Go to Settings"), button:has-text("⚙️")');
      const found = await settingsBtn.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (found) {
        console.log('📍 Clicking Settings button...');
        await settingsBtn.click();
        await page.waitForTimeout(2000);
        
        // Upload a collection file
        const fileInput = page.locator('input[type="file"]');
        if (await fileInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log('📍 Uploading collection CSV...');
          await fileInput.setInputFiles('/Users/mcg/Desktop/Collection from MTGA.csv');
          
          // Wait for processing
          await page.waitForTimeout(4000);
          
          // Screenshot showing upload complete
          await page.screenshot({ path: '/tmp/filters_after_upload.png' });
          
          // Navigate back to home
          await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
          await page.waitForTimeout(2000);
        }
      }
    }
    
    // Now test filters
    await page.screenshot({ path: '/tmp/filters_before_test.png' });
    
    const collectionTab = page.locator('button:has-text("My Collection")');
    const hasTab = await collectionTab.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (hasTab) {
      console.log('✅ Collection tab visible');
      await collectionTab.click();
      await page.waitForTimeout(1000);
      
      // Get filter buttons
      const filterButtons = page.locator('button[title]').filter({ hasText: /^[WUBRG C M]$/ });
      const btnCount = await filterButtons.count();
      
      if (btnCount === 0) {
        console.log('❌ No filter buttons found on collection page');
        await page.screenshot({ path: '/tmp/filters_no_buttons.png' });
      } else {
        console.log(`✅ Found ${btnCount} color filter buttons`);
        
        // Count initial cards
        const cardImages = page.locator('img[alt]');
        const initialCount = await cardImages.count();
        console.log(`📊 Initial card count: ${initialCount}`);
        
        if (initialCount === 0) {
          console.log('⚠️ No cards visible in grid - might be loading');
          await page.waitForTimeout(2000);
        }
        
        // Click first color filter
        const firstBtn = filterButtons.first();
        const color = await firstBtn.getAttribute('title');
        console.log(`📍 Clicking ${color} filter...`);
        
        await firstBtn.click();
        await page.waitForTimeout(1000);
        
        const afterClick = await cardImages.count();
        console.log(`📊 After clicking filter: ${afterClick} cards`);
        
        await page.screenshot({ path: '/tmp/filters_after_click_test.png' });
        
        // Determine if filters work
        if (afterClick < initialCount) {
          console.log('✅ FILTERS ARE WORKING - card count decreased');
        } else if (afterClick === initialCount && initialCount === 0) {
          console.log('⚠️ Cannot determine - no cards visible');
        } else {
          console.log('❌ FILTERS NOT WORKING - card count unchanged');
        }
      }
    } else {
      console.log('❌ Collection tab not visible');
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
