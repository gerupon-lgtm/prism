const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chooseChallenge}=require('./browser_wait.cjs');
const arg=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),engine=arg('--engine')||'chromium',channel=arg('--channel'),root=path.resolve('dist'),version=JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version;
const out=path.resolve('設計検証/課題カード',version,arg('--label')||'local',channel||engine);fs.mkdirSync(out,{recursive:true});const report={version,checks:[],layouts:[],pending:['Physical device display, accessibility text settings and touch feel remain unverified.']};
const server=http.createServer((req,res)=>{try{let f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(f===root)f=path.join(root,'index.html');if(!f.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.ttf':'font/ttf'})[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));}catch{res.writeHead(404).end();}});
(async()=>{let browser;await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
 browser=await pw[engine].launch({headless:true,...(channel?{channel}:{})});report.browser=browser.version();
 for(const scenario of process.argv.includes('--rotated-only')?[{name:'rotated',width:844,height:390,mobile:true}]:[{name:'phone',width:412,height:844},{name:'pixel',width:390,height:844},{name:'small',width:320,height:480},{name:'desktop',width:1440,height:900},{name:'enlarged',width:390,height:844,font:28}]){
  const context=await browser.newContext({viewport:{width:scenario.width,height:scenario.height},isMobile:!!scenario.mobile,hasTouch:!!scenario.mobile});
  if(scenario.mobile)await context.addInitScript(()=>{const o=new EventTarget();Object.defineProperties(o,{type:{value:'landscape-primary'},angle:{value:90}});Object.defineProperty(screen,'orientation',{get:()=>o});});
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(arg('--url')||'http://127.0.0.1:'+server.address().port);
  if(scenario.font)await p.addStyleTag({content:':root{font-size:'+scenario.font+'px!important}'});
  const ids=process.argv.includes('--all-stages')?await p.evaluate(async()=>{const {challenges}=await import(new URL('../content/challenges.js',document.querySelector('script[type=module]').src));return challenges.map(c=>c.id);}):['Q23','Q24','Q25','Q26','Q27','Q28'];
  await p.locator('#title-challenges').click();await chooseChallenge(p,ids[0]);const rows=[];
  for(const id of ids){
   if(id!==ids[0])await p.locator('#stage-next').click();
   await p.evaluate(async()=>{await document.fonts.ready;for(let i=0;i<6;i++)await new Promise(requestAnimationFrame);});
   const row=await p.evaluate(()=>{const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};},goal=document.getElementById('challenge-goal'),style=getComputedStyle(goal),c=document.createElement('canvas').getContext('2d');c.font=style.font;return {card:rect('challenge-info'),board:rect('board'),text:goal.textContent,goal:{h:goal.clientHeight,sh:goal.scrollHeight,w:goal.clientWidth,sw:goal.scrollWidth,font:style.font,lineHeight:style.lineHeight},proposedWidth:c.measureText('鐘1の0.5秒後に鐘2、さらに1秒後に鐘3を鳴らす').width,viewport:{w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight}};});row.id=id;rows.push(row);
   if(['Q26','Q27'].includes(id))await p.screenshot({path:path.join(out,scenario.name+'-'+id+'.png')});
  }
  report.layouts.push({scenario,rows});const heights=rows.map(r=>r.card.h);assert(Math.max(...heights)-Math.min(...heights)<.6,scenario.name+' fixed card height '+JSON.stringify(heights));
  for(const row of rows){assert(row.goal.sh<=row.goal.h+1&&row.goal.sw<=row.goal.w+1,scenario.name+' full text '+row.id);assert(row.viewport.sw<=row.viewport.w+1&&row.viewport.sh<=row.viewport.h+1,scenario.name+' page scroll');}
  const same=rows.filter(r=>['Q26','Q27','Q28'].includes(r.id));assert(Math.max(...same.map(r=>r.board.y))-Math.min(...same.map(r=>r.board.y))<.6,scenario.name+' stable board top');assert(Math.max(...same.map(r=>r.board.h))-Math.min(...same.map(r=>r.board.h))<.6,scenario.name+' stable board height');assert.deepEqual(errors,[]);
  report.checks.push({scenario:scenario.name,passed:true});await context.close();
 }
 report.passed=true;
}catch(error){report.passed=false;report.failure=error.stack;process.exitCode=1;}finally{await browser?.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,failure:report.failure,out}));}})();
