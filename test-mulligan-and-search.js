const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log('=== TESTING MULLIGAN & IMPROVED SEARCH ===\n');
    
    // Register and login
    const testUser = {
      username: 'mulligan' + Date.now(),
      email: 'test' + Date.now() + '@test.com',
      password: 'testpass123'
    };
    
    await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="text"]', testUser.username);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button:has-text("Sign in")');
    await page.waitForURL('http://localhost:3000');
    
    // Save collection
    await page.evaluate(async (text) => {
      await fetch('/api/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
    }, '2x Plains');
    
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    
    // Test different commanders
    const commanders = ['Atraxa', 'Yuriko', 'Edgar Markov'];
    
    for (const cmd of commanders) {
      console.log(`Testing commander search: "${cmd}"`);
      
      // Go to Play tab
      await page.click('button:has-text("Play")');
      await page.waitForTimeout(800);
      
      // Type commander
      const input = await page.locator('input[placeholder*="commander"]').first();
      await input.fill(cmd);
      
      // Check if we can click Start Game
      const startBtn = await page.locator('button:has-text("Start Game")').first();
      const startVisible = await startBtn.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (startVisible) {
        await startBtn.click();
        
        // Wait for mulligan screen
        let mulliganShown = false;
        for (let i = 0; i < 20; i++) {
          await page.waitForTimeout(500);
          const content = await page.innerText('body').catch(() => '');
          
          if (content.includes('Opening Hand')) {
            mulliganShown = true;
            console.log(`  ✅ "${cmd}" found and mulligan screen shown\n`);
            
            // Show the mulligan UI
            await page.screenshot({ path: `/tmp/mulligan-${cmd.replace(/\s+/g, '-').toLowerCase()}.png` });
            
            // Test keep hand
            const keepBtn = await page.locator('button:has-text("Keep Hand")').first();
            await keepBtn.click();
            
            // Wait for game to start
            for (let j = 0; j < 15; j++) {
              await page.waitForTimeout(500);
              const gameContent = await page.innerText('body').catch(() => '');
              if (gameContent.includes('Commander Game')) {
                console.log(`  ✅ Game started with ${cmd}\n`);
                break;
              }
            }
            break;
          }
        }
        
        if (!mulliganShown) {
          console.log(`  ❌ Mulligan screen not shown\n`);
        }
      } else {
        console.log(`  ❌ Could not find "${cmd}"\n`);
      }
      
      // Go back for next test
      if (cmd !== commanders[commanders.length - 1]) {
        // Click somewhere to go back
        await page.click('button:has-text("New Game")').catch(() => {});
        await page.waitForTimeout(1000);
      }
    }
    
    console.log('=== TESTS COMPLETE ===');
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
