import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Navigate to register page
    console.log('📍 Opening registration page...');
    await page.goto('http://localhost:3000/register', { waitUntil: 'networkidle' });
    
    // Create a test account
    const timestamp = Date.now();
    const testEmail = `test-${timestamp}@example.com`;
    const testUsername = `testuser${timestamp}`;
    
    console.log(`📍 Creating test account: ${testUsername}`);
    await page.fill('input[placeholder="Username"]', testUsername);
    await page.fill('input[placeholder="Email"]', testEmail);
    await page.fill('input[placeholder="Password"]', 'Test1234');
    await page.fill('input[placeholder="Confirm password"]', 'Test1234');
    
    await page.click('button:has-text("Create account")');
    
    // Wait for navigation
    await page.waitForURL('http://localhost:3000/', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2000);
    
    console.log('✅ Account created');
    
    // Now we need to upload a collection - check if there's a prompt
    const settingsLink = page.locator('a:has-text("Go to Settings"), a:has-text("⚙️ Settings")');
    if (await settingsLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('📍 Navigating to settings to upload collection...');
      await settingsLink.click();
      await page.waitForTimeout(2000);
      
      // Look for file upload input
      const fileInput = page.locator('input[type="file"]');
      if (await fileInput.isVisible()) {
        // Use the CSV file from Desktop
        console.log('📍 Uploading collection CSV...');
        await fileInput.setInputFiles('/Users/mcg/Desktop/Collection from MTGA.csv');
        
        // Wait for upload processing
        await page.waitForTimeout(3000);
        
        // Go back to main page
        await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
      }
    }
    
    // Check if collection is loaded
    const collectionTab = page.locator('button:has-text("My Collection")');
    const tabVisible = await collectionTab.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (tabVisible) {
      console.log('✅ Collection loaded');
      await collectionTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: '/tmp/filters_collection_loaded.png' });
      
      // Test filters
      const colorButtons = page.locator('button[title]').filter({ hasText: /^[WUBRG C M]$/ });
      const count = await colorButtons.count();
      
      if (count > 0) {
        console.log(`✅ Found ${count} color filter buttons`);
        
        const initialCards = await page.locator('img[alt]').count();
        console.log(`Initial: ${initialCards} cards`);
        
        await colorButtons.first().click();
        await page.waitForTimeout(800);
        
        const filtered = await page.locator('img[alt]').count();
        console.log(`After filter: ${filtered} cards`);
        
        if (filtered < initialCards) {
          console.log('✅ Filters ARE WORKING');
        } else {
          console.log('❌ Filters NOT WORKING - count unchanged');
        }
        
        await page.screenshot({ path: '/tmp/filters_test_result.png' });
      } else {
        console.log('❌ No filter buttons found');
      }
    } else {
      console.log('⚠️ No collection - upload may have failed');
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await browser.close();
  }
})();
