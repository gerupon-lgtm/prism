const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require('C:/Users/user/Documents/あとキュー/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core');
const arg=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1];};
const base=arg('--url')||'http://127.0.0.1:4185/',expectBug=process.argv.includes('--expect-bug'),fault=arg('--fault')||'suspend',cancel=arg('--cancel'),out=path.resolve(arg('--out')||'design-preview/ending-audio-resume-2026-11-21/evidence');fs.mkdirSync(out,{recursive:true});
const report={base,physicalDevice:false,injection:'Interrupt the audio output during silent media preparation, and capture real post-master samples.',fault,cancel,expectBug,errors:[]};
(async()=>{const browser=await pw.chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--mute-audio']});let p;try{
 const context=await browser.newContext({viewport:{width:410,height:844}});await context.addInitScript(({fault,cancel})=>{
  window.__audioContexts=[];window.__forcedSuspend=false;window.__resumeCalls=0;window.__playCalls=0;
  const Audio=window.AudioContext;window.AudioContext=class extends Audio{constructor(options){super(options);__audioContexts.push(this);}createGain(){const gain=super.createGain();this.__master??=gain;return gain;}resume(){if(++__resumeCalls===2&&cancel)return new Promise(resolve=>{window.__releaseResume=()=>super.resume().then(resolve);});return super.resume();}};
  const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(this.id==='ending-music')__playCalls++;return play.call(this);};
  const pause=HTMLMediaElement.prototype.pause;HTMLMediaElement.prototype.pause=function(){const warmup=this.id==='ending-music'&&this.volume===0&&!this.paused&&!__forcedSuspend;const result=pause.call(this);if(warmup){__forcedSuspend=true;const c=__audioContexts[0],a=c.createAnalyser(),silent=c.createGain();a.fftSize=2048;silent.gain.value=0;c.__master.connect(a);a.connect(silent);silent.connect(c.destination);window.__postMaster=a;if(fault==='gain')c.__master.gain.value=0;else if(fault==='media')this.muted=true;else window.__pauseSuspension=c.suspend();}return result;};
  window.__rms=()=>{const a=window.__postMaster;if(!a)return 0;const b=new Float32Array(a.fftSize);a.getFloatTimeDomainData(b);return Math.sqrt(b.reduce((n,x)=>n+x*x,0)/b.length);};
 },{fault,cancel});
 p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto(new URL('?ending=1',base).href);await p.evaluate(async()=>{window.__prismInspect=(await import(document.querySelector('script[type=module]').src)).inspectStory;});await p.waitForFunction(()=>__prismInspect().ending?.ready);
 await p.locator('#ending-next').click();
 if(cancel){await p.waitForFunction(()=>typeof __releaseResume==='function');if(cancel==='close'){await p.locator('#ending-chapters').click();await p.locator('#ending-exit').click();}else await p.locator('#ending-sound').click();await p.evaluate(()=>__releaseResume());if(cancel==='close'){await p.waitForTimeout(450);assert.equal(await p.locator('#ending-screen').count(),0);assert.equal(await p.evaluate(()=>__playCalls),1);report.cancelledWithoutLatePlay=true;}}
 if(cancel!=='close'){
  await p.waitForFunction(()=>!__prismInspect().ending.starting&&!__prismInspect().ending.paused);await p.waitForTimeout(250);report.first=await p.evaluate(()=>({ending:__prismInspect().ending,rms:__rms(),injected:__forcedSuspend}));assert.equal(report.first.injected,true);
  if(expectBug){if(fault==='suspend')assert.equal(report.first.ending.audioState,'suspended');assert.equal(report.first.rms,0);await p.locator('#ending-sound').click();await p.locator('#ending-sound').click();await p.waitForFunction(()=>__rms()>1e-5);report.afterToggle=await p.evaluate(()=>({ending:__prismInspect().ending,rms:__rms()}));assert.equal(report.afterToggle.ending.audioState,'running');}
  else if(cancel==='mute'){assert.equal(report.first.ending.sound,false);assert.equal(report.first.ending.mediaMuted,true);assert.equal(report.first.rms,0);report.explicitMutePreserved=true;}
  else{assert.equal(report.first.ending.sound,true);assert.equal(report.first.ending.audioState,'running');await p.waitForFunction(()=>__rms()>1e-5);report.withoutToggle=await p.evaluate(()=>({ending:__prismInspect().ending,rms:__rms()}));assert(report.withoutToggle.rms>1e-5);}
  await p.locator('#ending-chapters').click();await p.locator('#ending-exit').click();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;console.log(JSON.stringify(report));
 }catch(error){report.error=error.stack;if(p)report.state=await p.evaluate(()=>window.__prismInspect?.()).catch(()=>null);throw error;}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
