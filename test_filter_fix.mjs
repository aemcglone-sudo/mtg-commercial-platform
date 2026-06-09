import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Register new account
    console.log('Creating test account...');
    await page.goto('http://localhost:3000/register');
    const ts = Date.now();
    const user = `filterfix${ts}`;
    
    await page.fill('input[placeholder="Username"]', user);
    await page.fill('input[placeholder="Email"]', `${user}@t.com`);
    await page.fill('input[placeholder*="Password"]', 'TestPass1!');
    await page.fill('input[placeholder="Confirm password"]', 'TestPass1!');
    await page.click('button:has-text("Create account")');
    await page.waitForTimeout(1000);
    
    // Save collection
    console.log('Uploading collection...');
    await page.goto('http://localhost:3000/settings');
    const csv = `Name,Set,Qty,Type,Rarity,CMC
Lightning Bolt,LEA,1,Instant,uncommon,1
Counterspell,LEA,1,Instant,uncommon,2
Dark Ritual,LEA,1,Instant,uncommon,1
Stone Rain,LEA,1,Sorcery,uncommon,3
Terror,LEA,1,Instant,uncommon,2
Giant Growth,LEA,1,Instant,common,1
Holy Light,LEA,1,Sorcery,uncommon,3`;
    
    const textarea = page.locator('textarea');
    await textarea.fill(csv);
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(2000);
    
    // Go to collection
    console.log('Testing filters...');
    await page.goto('http://localhost:3000/');
    await page.waitForTimeout(1000);
    
    // Click CMC 3
    const cmc3 = page.locator('button').filter({ hasText: '3' }).first();
    const before = await page.locator('img[alt]').count();
    
    console.log(`Before CMC 3 filter: ${before} visible elements`);
    
    await cmc3.click();
    await page.waitForTimeout(500);
    
    const after = await page.locator('img[alt]').count();
    console.log(`After CMC 3 filter: ${after} visible elements`);
    
    // Check for no-match message
    const noMatch = page.locator('text="No cards match"');
    const showsNoMatch = await noMatch.isVisible({ timeout: 500 }).catch(() => false);
    
    if (showsNoMatch) {
      console.log('Shows: "No cards match these filters"');
      console.log('RESULT: ❌ Filter not working');
    } else if (after > 0) {
      console.log(`Shows: ${after} cards`);
      console.log('RESULT: ✅ Filter is working');
    } else {
      console.log('Cannot determine');
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
