const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {waitForAsync,dragConnection}=require('../../設計検証/browser_wait.cjs'),solutions=require('../../設計検証/challenge_fixtures.cjs');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';const pw=require('C:/Users/user/Documents/あとキュー/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core');
const at=process.argv.indexOf('--url'),url=at<0?'http://127.0.0.1:4191/':process.argv[at+1],out=path.join(__dirname,'evidence',at<0?'boundary-local':'boundary-public');fs.mkdirSync(out,{recursive:true});
const report={url,runs:[],errors:[],physicalDevice:false};
const read=p=>p.evaluate(async()=>{const m=await import(document.querySelector('script[type=module]').src);return {story:m.inspectStory(),performance:m.inspectPerformance()};});
const storyReady=p=>waitForAsync(p,async()=>{const m=await import(document.querySelector('script[type=module]').src);return m.inspectStory().active&&!m.inspectStory().loading;});
async function skip(p,block){await storyReady(p);assert.equal((await read(p)).story.block,block);await p.locator('#story-chapters').click();await p.locator('#story-skip').click();}
(async()=>{const browser=await pw.chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});let p;try{
 p=await browser.newPage({viewport:{width:410,height:844},reducedMotion:'reduce'});p.on('pageerror',e=>report.errors.push(e.message));await p.addInitScript(()=>{localStorage.setItem('prism-notes.result-timing.v1',JSON.stringify({version:1,clearMs:0,failureMs:1600}));});await p.goto(url);const catalogue=await p.evaluate(async()=>{const m=await import(new URL('../content/challenges.js',document.querySelector('script[type=module]').src));return m.challenges;});
 for(const cancel of [false,true]){
  if(cancel){await p.locator('#menu').click();await p.locator('#dialog-body button').filter({hasText:/^タイトルへ$/}).click();}
  await p.locator('#title-start').click();await skip(p,'P');const run={cancel,stages:[]};
  for(let i=0;i<3;i++){const c=catalogue[i];for(const id of solutions[c.id]){const edge=c.candidates.find(e=>e.id===id);await dragConnection(p,edge.from,edge.to);}await p.locator('#play').click();await p.locator('#clear-toast').waitFor({state:'visible',timeout:15000});assert.equal(parseFloat(await p.locator('#clear-score').textContent()),100);const state=await read(p);run.stages.push({id:c.id,clock:state.performance.run.clock,score:await p.locator('#clear-score').textContent()});
   const start=Date.now();await p.locator('#clear-next').click();if(i<2)continue;assert((await read(p)).story.transitionPending);run.bellDurations=state.story.bells.map(b=>b.end-b.time);assert(run.bellDurations.some(d=>Math.abs(d-2.62)<1e-6));
   if(cancel){await p.locator('#stop').click();await p.waitForTimeout(450);const stopped=await read(p);assert.equal(stopped.story.active,false);assert.equal(stopped.story.transitionPending,false);assert.equal(stopped.story.journey.stage,3);assert.equal(stopped.performance.run.clock,state.performance.run.clock);assert.equal(await p.locator('#clear-next').isEnabled(),true);await p.locator('#clear-next').click();}
   await storyReady(p);assert.equal((await read(p)).story.block,'M1');if(!cancel){run.advanceMs=Date.now()-start;assert(run.advanceMs>=250&&run.advanceMs<900);}await skip(p,'M1');assert.equal((await read(p)).story.journey.stage,4);
  }report.runs.push(run);
 }
 assert.deepEqual(report.errors,[]);report.passed=true;console.log(JSON.stringify(report));
}catch(error){report.error=error.stack;if(p)await p.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error;}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
