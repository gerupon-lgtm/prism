// Natural animation frames, not paused animations or manually assigned currentTime.
// Forced media settings and phone viewports are labelled simulations; no device-speed claim.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {enterApp,selectChallenge,dragConnection,setSound}=require('./browser_wait.cjs');
const arg=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),channel=arg('--channel'),root=path.resolve(__dirname,'../dist'),out=path.join(__dirname,'演出の動き',channel||'');fs.mkdirSync(out,{recursive:true});
const report={version:JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version,url:arg('--url')||'local build',checks:[],browsers:[],evidence:'Real elapsed animation frames in PC browsers. Media settings and mobile viewports are simulated. Native user Chrome setting was read separately.'};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.ttf':'font/ttf'};
const server=http.createServer((req,res)=>{try{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file===root)file=path.join(root,'index.html');if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
function verify(samples,reduced,label){
 const fire=samples.filter(s=>s.fire),prism=samples.filter(s=>s.prism),bell=samples.filter(s=>s.bell),moving=samples.filter(s=>s.moving),launch=samples.filter(s=>s.launch);
 assert(fire.length>10&&prism.length>5&&bell.length>10,label+' captures all effects over time');assert(new Set(moving.map(s=>s.moving)).size>3,label+' light particles actually travel');assert(launch.length>1,label+' launch prelude precedes movement');
 const starts=Array.from({length:5},(_,i)=>fire.find(s=>s.fire.rays[i]>.05)?.fire.age);assert(starts.every(Number.isFinite),label+' every firework becomes visible');
 if(reduced){
  assert(starts.every(t=>t===starts[0]),label+' reduced fireworks appear together');assert(fire.every(s=>s.fire.animations.every(n=>n==='none')&&s.fire.rocketDisplay==='none'),label+' reduced fireworks are static');
  assert(new Set(prism.map(s=>s.prism.transform)).size===1&&prism.every(s=>s.prism.animation==='none'),label+' reduced prism shards are static');
  assert(new Set(prism.map(s=>s.prism.glow)).size===1&&new Set(bell.map(s=>s.bell.column)).size===1,label+' reduced arrival glow and column are static');
  assert(bell.every(s=>s.bell.stars===26&&s.bell.lineAnimation==='none'&&parseFloat(s.bell.offset)===0&&s.bell.beaconAnimation==='none'),label+' reduced bell constellation is complete and static');
 }else{
  assert(starts.every((t,i)=>!i||t>starts[i-1])&&starts[4]-starts[0]>400,label+' five fireworks start successively: '+JSON.stringify(starts));
  assert(new Set(fire.map(s=>s.fire.offset)).size>3,label+' rocket trails advance');assert(new Set(prism.map(s=>s.prism.transform)).size>3,label+' prism shards spread');
  assert(new Set(prism.map(s=>s.prism.glow)).size>3&&new Set(bell.map(s=>s.bell.column)).size>3,label+' arrival glow and column fade');
  assert(bell.some(s=>s.bell.stars<26)&&bell.some(s=>s.bell.stars===26),label+' constellation stars appear progressively');assert(new Set(bell.map(s=>s.bell.offset)).size>3,label+' constellation links grow');assert(new Set(bell.map(s=>s.bell.beaconTransform)).size>3,label+' bell beacon expands');
 }
 return {fireworkStartAges:starts,frames:{fire:fire.length,prism:prism.length,bell:bell.length,moving:moving.length,launch:launch.length}};
}
(async()=>{let browser;await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
 for(const engine of channel?['chromium']:arg('--engine')?[arg('--engine')]:['chromium','webkit']){
  browser=await pw[engine].launch({headless:true,...(channel?{channel}:{})});report.browsers.push({engine,channel,version:browser.version()});
  for(const mobile of [false,true])for(const reduced of [false,true]){
   const label=`${channel||engine} ${mobile?'phone simulation':'desktop'} ${reduced?'reduce':'normal'}`,page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1366,height:900},isMobile:mobile,hasTouch:mobile,reducedMotion:reduced?'reduce':'no-preference'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(arg('--url')||`http://127.0.0.1:${server.address().port}/`);await enterApp(page);assert.equal(await page.locator('meta[name=prism-version]').getAttribute('content'),report.version);await selectChallenge(page,'Q1');await dragConnection(page,'S','A');await dragConnection(page,'A','G');await setSound(page,false);
   await page.evaluate(()=>{
    window.__motionSamples=[];window.__motionDone=false;const starts=new WeakMap();let began=null,previous=-Infinity;
    const style=e=>e&&getComputedStyle(e),age=(e,t)=>{if(!starts.has(e))starts.set(e,t);return t-starts.get(e);};
    function sample(now){
     began??=now;if(now-previous>=65){previous=now;const fire=document.querySelector('.perfect-fireworks'),prism=document.querySelector('.prism-arrival'),bell=document.querySelector('.arrival-art:not(.prism-arrival)'),particle=document.querySelector('.light-particle.moving'),play=document.getElementById('play');
      const row={at:now-began,launch:play.dataset.state==='preparing',moving:particle?.getAttribute('transform')??null};
      if(fire){const bursts=[...fire.querySelectorAll('.firework')],rocket=fire.querySelector('.firework-rocket');row.fire={age:age(fire,now),rays:bursts.map(e=>Number(style(e.querySelector('.firework-ray')).opacity)),animations:bursts.map(e=>style(e.querySelector('.firework-ray')).animationName),offset:style(rocket).strokeDashoffset,rocketDisplay:style(rocket).display};}
      if(prism){const shard=prism.querySelector('.prism-shard');row.prism={age:age(prism,now),transform:style(shard).transform,animation:style(shard).animationName,glow:style(prism.querySelector('.prism-arrival-glow')).opacity};}
      if(bell){const link=bell.querySelector('.constellation-line'),beacon=bell.querySelector('.bell-arrival-beacon');row.bell={age:age(bell,now),stars:[...bell.querySelectorAll('.constellation-star')].filter(e=>Number(style(e).opacity)>.05).length,offset:style(link).strokeDashoffset,lineAnimation:style(link).animationName,beaconTransform:style(beacon).transform,beaconAnimation:style(beacon).animationName,column:style(bell.querySelector('.altar-column')).opacity};}
      window.__motionSamples.push(row);
     }if(now-began<5900)requestAnimationFrame(sample);else window.__motionDone=true;
    }requestAnimationFrame(sample);
   });
   await page.locator('#play').click();
   if(process.argv.includes('--pictures')&&!mobile){for(const ms of [150,950]){await page.waitForFunction(ms=>window.__motionSamples.some(s=>s.fire?.age>=ms),ms,{timeout:7000});await page.screenshot({path:path.join(out,`${channel||engine}-${reduced?'reduce':'normal'}-${ms}.png`)});}}
   await page.waitForFunction(()=>window.__motionDone,null,{timeout:9000});const samples=await page.evaluate(()=>window.__motionSamples);const details=verify(samples,reduced,label);report.lastCase={label,details,samples,beforeReturn:await page.evaluate(()=>({play:document.getElementById('play').dataset.state,result:document.getElementById('result').textContent}))};assert((await page.locator('#result').textContent()).includes('100.00点'));
   // Sampling starts before the click; input dispatch can finish later on WebKit.
   // Wait for the actual editing state rather than treating sample duration as run duration.
   await page.waitForFunction(()=>document.getElementById('play').dataset.state==='stopped',null,{timeout:3500});assert.equal(await page.locator('.perfect-fireworks,.arrival-art').count(),0);assert.deepEqual(errors,[]);
   report.checks.push({label,passed:true,reduced,mobile,...details,samples});console.log(label+' passed '+JSON.stringify(details.fireworkStartAges));await page.close();
  }await browser.close();browser=null;
 }delete report.lastCase;report.passed=true;console.log('Motion checks passed: '+report.checks.length);
}catch(e){report.passed=false;report.failure=e.stack;console.error(e.stack);process.exitCode=1;}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}})();
