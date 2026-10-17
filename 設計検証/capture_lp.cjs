// Capture real public UI in disposable profiles; no app code or clocks are changed.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chooseChallenge,challengeSolution,dragConnection,setSound}=require('./browser_wait.cjs');
const arg=k=>{const i=process.argv.indexOf(k);return i<0?null:process.argv[i+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),base='https://prism.sikumilab.com/',out=path.resolve(__dirname,'../docs/lp'),version=JSON.parse(fs.readFileSync(path.join(__dirname,'../package.json'))).version;
fs.mkdirSync(path.join(out,'img'),{recursive:true});
const report={version,url:base,checkedAt:new Date().toISOString(),evidence:'Unedited public-page captures. Disposable PC Chrome profiles; phone viewport and touch are emulated, not a physical device.',images:[]};
async function settle(page){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(i=>i.getClientRects().length).map(i=>i.decode().catch(()=>{})));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});}
async function capture(page,name,description){await settle(page);assert.equal(await page.locator('meta[name=prism-version]').getAttribute('content'),version);const size=await page.evaluate(()=>({viewport:[innerWidth,innerHeight],page:[document.documentElement.scrollWidth,document.documentElement.scrollHeight]}));assert(size.page[0]<=size.viewport[0]+1&&size.page[1]<=size.viewport[1]+1);await page.screenshot({path:path.join(out,'img',name)});report.images.push({file:'img/'+name,description,...size});}
(async()=>{let browser;try{
 const {challenges}=await import('../src/content/challenges.js');browser=await pw.chromium.launch({channel:'chrome',headless:true});report.browser=browser.version();
 let context=await browser.newContext({viewport:{width:1600,height:1000}}),page=await context.newPage();await page.goto(base);await page.locator('#title-tutorial').waitFor();await capture(page,'prism-notes-title.png','公開版のタイトル画面、PC1600×1000');await context.close();
 for(const [width,height,mobile,id,name]of[[390,844,true,'Q8','prism-notes-mobile.png'],[1600,1000,false,'Q9','prism-notes-desktop.png']]){
  context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile});page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.locator('#title-challenges').click();await chooseChallenge(page,id);await setSound(page,false);const authored=challenges.find(q=>q.id===id),edges=await challengeSolution(page,id);
  for(const edgeId of edges){const edge=authored.candidates.find(e=>e.id===edgeId);await dragConnection(page,edge.from,edge.to);}assert.equal(await page.locator('.edge:not(.candidate)').count(),edges.length);
  await page.locator('#play').click();await page.waitForFunction(()=>document.getElementById('result').textContent.includes('100.00点'),null,{timeout:15000});await page.locator('#clear-dismiss').click();await page.waitForFunction(()=>document.getElementById('stop').disabled&&!document.getElementById('play').disabled,null,{timeout:10000});
  await capture(page,name,`公開版${id}の満点クリア後。${mobile?'スマホ相当':'PC'}${width}×${height}、実際の結線・時間経過で到達。`);report.images.at(-1).problem=await page.locator('#app').getAttribute('data-problem-id');assert.deepEqual(errors,[]);await context.close();
 }
 report.passed=true;console.log('Captured '+report.images.length+' real public UI images.');
}catch(e){report.passed=false;report.error=e.stack;console.error(e);process.exitCode=1;}finally{if(browser)await browser.close();fs.writeFileSync(path.join(out,'capture-info.json'),JSON.stringify(report,null,2));}})();
