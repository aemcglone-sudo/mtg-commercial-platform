import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:3000/register', { waitUntil: 'networkidle' });
    
    // Get all input fields
    const inputs = await page.locator('input').all();
    console.log(`Found ${inputs.length} input fields:`);
    
    for (const input of inputs) {
      const type = await input.getAttribute('type');
      const placeholder = await input.getAttribute('placeholder');
      const name = await input.getAttribute('name');
      console.log(`  - type: ${type}, placeholder: "${placeholder}", name: "${name}"`);
    }
    
    // Get all buttons
    const buttons = await page.locator('button').all();
    console.log(`\nFound ${buttons.length} buttons:`);
    
    for (let i = 0; i < Math.min(5, buttons.length); i++) {
      const text = await buttons[i].textContent();
      console.log(`  - "${text.trim()}"`);
    }
    
    await page.screenshot({ path: '/tmp/register_page.png' });
    
  } finally {
    await browser.close();
  }
})();
