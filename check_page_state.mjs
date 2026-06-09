import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:3000/');
    await page.waitForTimeout(2000);
    
    // Get page content
    const html = await page.content();
    
    // Check for key elements
    const hasCollectionTab = html.includes('My Collection');
    const hasNoCollection = html.includes('No collection yet');
    const hasFilters = html.includes('Color') && html.includes('Type');
    const hasCMCButtons = /button[^>]*>3<\/button/.test(html);
    
    console.log('Page state:');
    console.log(`- Has "My Collection" tab: ${hasCollectionTab}`);
    console.log(`- Has "No collection yet" message: ${hasNoCollection}`);
    console.log(`- Has filter labels: ${hasFilters}`);
    console.log(`- Has CMC buttons: ${hasCMCButtons}`);
    
    // Take screenshot
    await page.screenshot({ path: '/tmp/page_state.png' });
    console.log('Screenshot saved');
    
  } finally {
    await browser.close();
  }
})();
