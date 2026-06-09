import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Capture network requests
  let saveResponse = null;
  page.on('response', async (response) => {
    if (response.url().includes('/api/collection') && response.request().method() === 'POST') {
      saveResponse = {
        status: response.status(),
        url: response.url(),
        body: await response.json().catch(() => 'Could not parse JSON')
      };
      console.log('POST /api/collection response:', saveResponse);
    }
  });
  
  try {
    // Register
    console.log('Creating account...');
    await page.goto('http://localhost:3000/register');
    const ts = Math.random().toString(36).slice(2, 8);
    const user = `dt${ts}`;
    
    await page.fill('input[placeholder="Username"]', user);
    await page.fill('input[placeholder="Email"]', `${user}@test.com`);
    await page.fill('input[placeholder*="Password"]', 'Test1234!!');
    await page.fill('input[placeholder="Confirm password"]', 'Test1234!!');
    await page.click('button:has-text("Create account")');
    await page.waitForTimeout(1500);
    
    // Go to settings
    console.log('Going to settings...');
    await page.goto('http://localhost:3000/settings');
    await page.waitForTimeout(1000);
    
    // Fill collection text
    const csvContent = `Name,Set code,Set name,Quantity
Lightning Bolt,LEA,Limited Edition Alpha,4
Dark Ritual,LEA,Limited Edition Alpha,3`;
    
    const textarea = page.locator('textarea');
    await textarea.fill(csvContent);
    await page.waitForTimeout(500);
    
    // Click save
    console.log('Clicking save collection...');
    const saveBtn = page.locator('button:has-text("Save collection")');
    await saveBtn.click();
    
    // Wait for network response
    await page.waitForTimeout(3000);
    
    if (saveResponse) {
      console.log('✅ Save response received:', saveResponse);
      if (saveResponse.status === 200) {
        console.log('✅ Collection saved successfully');
      } else {
        console.log('❌ Save failed with status:', saveResponse.status);
      }
    } else {
      console.log('⚠️ No save response received');
    }
    
    // Check the page for success message
    const successMsg = page.locator('text="Saved!"');
    const visible = await successMsg.isVisible({ timeout: 1000 }).catch(() => false);
    if (visible) {
      const text = await successMsg.textContent();
      console.log('✅ Success message:', text);
    } else {
      console.log('⚠️ No success message visible');
    }
    
    await page.screenshot({ path: '/tmp/debug_save.png' });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
