import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,chromiumSandbox:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8787');
 await page.getByRole('button',{name:'Load demonstration'}).click();
 await page.waitForFunction(()=>document.getElementById('answers').value.length>0);
 await page.getByRole('button',{name:'Evaluate evidence'}).click();
 await page.waitForFunction(()=>!document.getElementById('results').hidden);
 assert.match(await page.locator('#summary').textContent(),/"fixture_matched": 0/);
 const download=page.waitForEvent('download');await page.getByText('Download HTML report',{exact:true}).click();assert.equal((await download).suggestedFilename(),'qa-report.html');
 await page.locator('#answers').fill('{');await page.getByRole('button',{name:'Evaluate evidence'}).click();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('invalid JSON'));assert.equal(await page.locator('#results').isHidden(),true);
 const payload=JSON.stringify({case_id:'QA2-001',answer_text:'<img src=x onerror="window.pwned=1">',run_timestamp:'2026-10-01T12:00:00Z',trace:null});
 await page.locator('#file').setInputFiles({name:'synthetic.jsonl',mimeType:'text/plain',buffer:Buffer.from(payload)});
 await page.waitForFunction(()=>document.getElementById('answers').value.includes('onerror'));
 await page.getByRole('button',{name:'Evaluate evidence'}).click();await page.waitForFunction(()=>!document.getElementById('results').hidden);
 assert.equal(await page.evaluate(()=>window.pwned),undefined);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 assert.deepEqual(errors,[]);console.log('Browser QA passed: demo, evaluation, report download, invalid-input recovery, file upload, XSS, mobile overflow, no page errors.');
}finally{await browser.close();}
