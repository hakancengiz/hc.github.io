import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {devPackage} from './dependencies.mjs';
import {createPreview,root} from './preview.mjs';
const {chromium}=devPackage('playwright-core'),output=process.env.QA_OUTPUT_DIR||path.join(os.tmpdir(),'hcengiz-qa');fs.mkdirSync(output,{recursive:true});
// Prove that the deliverable runs independently with only index.html + its one asset folder.
const packageRoot=fs.mkdtempSync(path.join(output,'package-'));
fs.copyFileSync(path.join(root,'index.html'),path.join(packageRoot,'index.html'));
for(const name of ['css','js','fonts','universe-images'])fs.cpSync(path.join(root,'universe-portfolio-assets',name),path.join(packageRoot,'universe-portfolio-assets',name),{recursive:true});
assert.deepEqual(fs.readdirSync(packageRoot).sort(),['index.html','universe-portfolio-assets']);
const server=createPreview(packageRoot);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
const executable=process.env.CHROME_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(file=>fs.existsSync(file));
const browser=await chromium.launch({...(executable?{executablePath:executable}:{}),headless:true});
const report=[];
try{
  for(const width of [320,390,1440]){
    const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:width<761?2:1,isMobile:width<761,hasTouch:width<761});
    await context.route('**/googletagmanager.com/**',route=>route.fulfill({contentType:'text/javascript',body:''}));
    const page=await context.newPage(),errors=[],failures=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});page.on('response',response=>{if(response.status()>=400&&response.url().startsWith(base))failures.push(response.url());});
    await page.addInitScript(()=>{const request=window.requestAnimationFrame;window.__framesRequested=0;window.requestAnimationFrame=callback=>{window.__framesRequested++;return request(callback);};});
    await context.route('**/api.rss2json.com/**',async route=>{const posts=await page.evaluate(()=>window.PORTFOLIO_BLOG);await route.fulfill({contentType:'application/json',body:JSON.stringify({status:'ok',items:posts})});});
    if(width<761){const session=await context.newCDPSession(page);await session.send('Emulation.setCPUThrottlingRate',{rate:4});}
    await page.goto(base,{waitUntil:'load'});await page.waitForFunction(()=>document.documentElement.classList.contains('switch-hint-ready'));
    await page.evaluate(()=>{window.__testClicks=[];document.addEventListener('click',event=>window.__testClicks.push({target:event.target.outerHTML.slice(0,180),detail:event.detail,world:document.documentElement.dataset.world}),true);});
    assert.equal(await page.locator('#navigation [aria-current]').count(),0);
    assert.equal(await page.locator('#world-share').count(),0);
    const images=await page.evaluate(()=>[...document.images].filter(img=>img.getAttribute('src')).map(img=>img.currentSrc));
    assert.ok(!images.some(url=>/hakan-(elf|wizard|jedi)/.test(url)),'Inactive portraits are not fetched');
    const initial=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,transfer:performance.getEntriesByType('resource').filter(item=>item.name.startsWith(location.origin)).reduce((n,item)=>n+item.transferSize,0),fonts:document.fonts.status}));assert.equal(initial.overflow,false);
    const idleStart=await page.evaluate(()=>window.__framesRequested);await page.waitForTimeout(500);assert.ok((await page.evaluate(()=>window.__framesRequested))-idleStart<4,'No continuous idle frame loop');
    assert.equal(await page.locator('.hero-actions .btn').first().evaluate(node=>getComputedStyle(node).borderTopWidth),'0px');
    for(const expected of ['elf','wizard','jedi','pixel']){
      await page.locator('#world-switch').click();
      try{await page.waitForFunction(id=>document.documentElement.dataset.world===id,expected,{timeout:10000});}catch(error){await page.screenshot({path:path.join(output,'debug-'+width+'.png')});console.log(JSON.stringify({expected,errors,failures,state:await page.evaluate(()=>({clicks:window.__testClicks,world:document.documentElement.dataset.world,toast:document.querySelector('#toast').textContent}))},null,2));throw error;}
      assert.ok(await page.locator('[data-portrait-world="'+expected+'"]').evaluate(img=>img.complete&&img.naturalWidth>0));
    }
    await page.locator('#abilities').scrollIntoViewIfNeeded();await page.locator('[data-skill-filter="backend"]').click();assert.equal(await page.locator('[data-skill-category]:visible').count(),1);await page.locator('[data-skill-filter="all"]').click();assert.equal(await page.locator('[data-skill-category]:visible').count(),4);
    await page.locator('#contact').scrollIntoViewIfNeeded();await page.locator('#cf-name').fill('Performance check');await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.locator('#world-switch').click();await page.waitForFunction(()=>document.documentElement.dataset.world==='elf');assert.equal(await page.locator('#cf-name').inputValue(),'Performance check');
    await page.reload({waitUntil:'load'});assert.equal(await page.locator('html').getAttribute('data-world'),'elf');await page.waitForFunction(()=>document.documentElement.classList.contains('motion-intro-complete'));
    await page.locator('#abilities').evaluate(node=>scrollTo({top:node.getBoundingClientRect().top+scrollY-document.querySelector('.site-header').getBoundingClientRect().height-10,behavior:'instant'}));
    await page.waitForFunction(()=>document.querySelector('#navigation [href="#abilities"]').getAttribute('aria-current')==='location');
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('.skills-controls')).opacity==='1');
    await page.screenshot({path:path.join(output,'categories-'+width+'.png')});
    await page.locator('#contact').scrollIntoViewIfNeeded();await page.waitForFunction(()=>getComputedStyle(document.querySelector('.contact-panel')).opacity==='1');assert.equal(await page.locator('#cf-name').evaluate(node=>getComputedStyle(node).borderTopWidth),'0px');await page.screenshot({path:path.join(output,'contact-'+width+'.png')});
    await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForFunction(()=>!document.querySelector('#navigation [aria-current]'));
    await page.goto(base+'/?world=cosmic',{waitUntil:'load'});assert.equal(await page.locator('html').getAttribute('data-world'),'jedi');
    await page.waitForFunction(()=>document.documentElement.classList.contains('switch-hint-ready'));
    await page.screenshot({path:path.join(output,'performance-'+width+'.png'),fullPage:false});
    if(width<761)assert.equal(await page.locator('.ambient-glyph').first().evaluate(node=>getComputedStyle(node).animationName),'none');
    assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);report.push({width,...initial});await context.close();
  }
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
