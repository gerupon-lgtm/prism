const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require('C:/Users/user/Documents/あとキュー/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core');
const arg=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1];},base=arg('--url')||'http://127.0.0.1:4185/',out=path.resolve(arg('--out')||'design-preview/update-recovery-2026-11-21/evidence/start');fs.mkdirSync(out,{recursive:true});
const report={base,physicalDevice:false,errors:[],checks:[]};
(async()=>{const browser=await pw.chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--mute-audio']});let p;try{
 p=await browser.newPage({viewport:{width:410,height:844}});p.on('pageerror',e=>report.errors.push(e.message));
 await p.addInitScript(()=>{window.__musicPlayCalls=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(this.id==='ending-music')__musicPlayCalls.push({wall:performance.now(),position:this.currentTime,volume:this.volume,state:window.__prismInspect?.().ending.audioState});return play.call(this);};});
 await p.goto(new URL('?ending=1',base).href);await p.evaluate(async()=>{window.__prismInspect=(await import(document.querySelector('script[type=module]').src)).inspectStory;});await p.waitForFunction(()=>__prismInspect().ending?.ready);
 const inspect=()=>p.evaluate(()=>__prismInspect().ending);
 await p.locator('#ending-next').click();await p.waitForFunction(()=>!__prismInspect().ending.starting&&__prismInspect().ending.time>.15&&__prismInspect().ending.effectiveVolume>.69);
 const calls=await p.evaluate(()=>__musicPlayCalls);assert.equal(calls.length,2);assert.equal(calls[0].volume,0);assert.equal(calls[1].volume,1);assert(calls[1].position<.01);assert(calls[1].wall-calls[0].wall>=340);assert.equal(calls[1].state,'running');
 await p.waitForFunction(()=>{const w=__prismInspect().ending.wakeLock;return !w.supported||w.held||w.error;});const wake=(await inspect()).wakeLock;if(wake.supported)assert.equal(wake.held,true,JSON.stringify(wake));
 report.checks.push({initialPlays:calls,openingAtZero:true,noOpeningFade:true,wakeLock:wake});
 await p.locator('#ending-play').click();await p.waitForFunction(()=>__prismInspect().ending.paused);assert.equal((await inspect()).wakeLock.held,false);
 await p.locator('#ending-play').click();await p.waitForFunction(()=>!__prismInspect().ending.starting&&!__prismInspect().ending.paused);await p.locator('#ending-chapters').click();assert.equal((await inspect()).wakeLock.held,false);await p.locator('#ending-scene-list button[data-scene="S01"]').click();
 await p.locator('#ending-play').click();await p.waitForFunction(()=>__prismInspect().ending.starting);const before=await p.evaluate(()=>__musicPlayCalls.length);await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;});await p.waitForTimeout(500);assert.equal((await inspect()).paused,true);assert.equal((await inspect()).wakeLock.held,false);assert.equal(await p.evaluate(()=>__musicPlayCalls.length),before,'cancelled preroll must not call play later');
 await p.locator('#ending-play').click();await p.waitForFunction(()=>__prismInspect().ending.starting);await p.locator('#ending-chapters').click();await p.locator('#ending-exit').click();await p.waitForTimeout(450);assert.equal(await p.locator('#ending-screen').count(),0);assert.equal(await p.locator('audio').evaluateAll(es=>es.some(e=>!e.paused)),false);
 report.checks.push({pauseReleases:true,menuReleases:true,hiddenCancelsPreroll:true,exitCancelsPreroll:true});assert.deepEqual(report.errors,[]);report.passed=true;console.log(JSON.stringify(report));
 }catch(error){report.error=error.stack;if(p)report.state=await p.evaluate(()=>window.__prismInspect?.()).catch(()=>null);throw error;}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
