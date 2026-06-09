import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Quick setup
    console.log('Setting up test...');
    await page.goto('http://localhost:3000/register');
    const ts = Date.now();
    const user = `ft${ts}`;
    
    await page.fill('input[placeholder="Username"]', user);
    await page.fill('input[placeholder="Email"]', `${user}@t.com`);
    await page.fill('input[placeholder*="Password"]', 'P@ss1234');
    await page.fill('input[placeholder="Confirm password"]', 'P@ss1234');
    await page.click('button:has-text("Create account")');
    await page.waitForTimeout(1000);
    
    // Save collection
    await page.goto('http://localhost:3000/settings');
    await page.waitForTimeout(500);
    const csv = `Name,Set,Qty\nBolt,LEA,1\nRitual,LEA,1\nCounter,LEA,1`;
    await page.locator('textarea').fill(csv);
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(2000);
    
    // Home
    await page.goto('http://localhost:3000/');
    await page.waitForTimeout(1000);
    
    // Find filter buttons
    const filters = page.locator('button').filter({ hasText: /^[WUBRG CM]$/ });
    const n = await filters.count();
    
    if (n === 0) {
      console.log('ERROR: No filter buttons found');
      process.exit(1);
    }
    
    console.log(`Found ${n} filters`);
    
    // Count cards
    const cards = page.locator('img[alt]');
    const before = await cards.count();
    console.log(`Before: ${before} cards`);
    
    // Click filter
    const btn = filters.nth(0);
    await btn.click();
    await page.waitForTimeout(500);
    
    const after = await cards.count();
    console.log(`After: ${after} cards`);
    
    // Check for no-match message
    const noMatch = page.locator('text="No cards match"');
    const hasNoMatch = await noMatch.isVisible({ timeout: 500 }).catch(() => false);
    
    if (before > after) {
      console.log('RESULT: FILTERS WORK ✅');
      process.exit(0);
    } else if (hasNoMatch) {
      console.log('RESULT: FILTERS WORK (showing no-match message) ✅');
      process.exit(0);
    } else {
      console.log('RESULT: FILTERS BROKEN ❌');
      console.log(`Count unchanged: ${before} -> ${after}`);
      process.exit(1);
    }
    
  } catch (err) {
    console.error('TEST ERROR:', err.message);
    process.exit(2);
  } finally {
    await browser.close();
  }
})();
