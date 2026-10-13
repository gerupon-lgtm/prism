const {enterApp,startGuide,skipGuide}=require('./browser_wait.cjs');
// PC engines with synthetic Screen Orientation values; not physical-device evidence.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const arg=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
if(!arg('--playwright-path'))throw new Error('Pass --playwright-path');
process.env.PLAYWRIGHT_BROWSERS_PATH=arg('--browser-cache')||'C:/Users/user/AppData/Local/ms-playwright';
const pw=require(path.resolve(arg('--playwright-path'))),channel=arg('--channel');
if(channel&&!['chrome','msedge'].includes(channel))throw new Error('Use chrome or msedge');
const root=path.resolve(__dirname,'../dist'),out=path.join(__dirname,'方向保持',channel||'');fs.mkdirSync(out,{recursive:true});
const report={version:JSON.parse(fs.readFileSync(path.join(__dirname,'../package.json'),'utf8')).version,evidence:'PC browser with synthetic screen orientation API and touch-capable viewport. No real phone, notch, keyboard or OS rotation evidence.',checks:[],browsers:[]};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.ttf':'font/ttf','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(file===root)file=path.join(root,'index.html');try{res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
const settle=p=>p.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
async function direction(page,type,angle,width,height){await page.evaluate(({type,angle})=>{Object.assign(window.__direction,{type,angle});}, {type,angle});await page.setViewportSize({width,height});await page.evaluate(()=>screen.orientation.dispatchEvent(new Event('change')));await settle(page);}
async function measure(page,label,rotation){
 await settle(page);const layout=await page.evaluate(()=>{
  const box=e=>{const r=e.getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom,x:r.x+r.width/2,y:r.y+r.height/2};};
  const visible=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
  const get=id=>box(document.getElementById(id));
  const nodes=[...document.querySelectorAll('[data-node]')].map(e=>{const m=e.getScreenCTM();return {id:e.dataset.node,hit:box(e.querySelector('.node-hit')),text:box(e.querySelector('.node-name')),matrix:[m.a,m.b,m.c,m.d]};});
  return {rotation:Number(document.documentElement.dataset.boardRotation),viewport:[innerWidth,innerHeight],document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],board:get('board'),header:box(document.querySelector('header')),play:get('play-controls'),first:get('play'),last:get('sound'),add:get('add-controls'),zoom:box(document.querySelector('.zoom-controls')),nodes,items:[...document.querySelectorAll('.orientation-region,button,dialog[open]')].filter(visible).map(e=>({id:e.id||e.className,box:box(e),client:[e.clientWidth,e.clientHeight],scroll:[e.scrollWidth,e.scrollHeight]}))};
 });
 report.checks.push({label,...layout});
 assert.equal(layout.rotation,rotation,label+' rotation');assert(layout.document[0]<=layout.viewport[0]&&layout.document[1]<=layout.viewport[1],label+' page scroll');
 const s=layout.nodes.find(n=>n.id==='S'),g=layout.nodes.find(n=>n.id==='G');
 if(rotation===0){assert(s.hit.y>g.hit.y,label+' source below goal');assert(layout.header.y<layout.board.y&&layout.play.y>layout.board.y,label+' frame order');}
 if(rotation===-90){assert(s.hit.x>g.hit.x,label+' source remains device bottom/right');assert(layout.header.x<layout.board.x&&layout.play.x>layout.board.x,label+' frame order');assert(layout.first.y>layout.last.y,label+' control order');}
 if(rotation===90){assert(s.hit.x<g.hit.x,label+' source remains device bottom/left');assert(layout.header.x>layout.board.x&&layout.play.x<layout.board.x,label+' frame order');assert(layout.first.y<layout.last.y,label+' control order');}
 if(rotation===180){assert(s.hit.y<g.hit.y,label+' inverted source remains device bottom/top');assert(layout.header.y>layout.board.y&&layout.play.y<layout.board.y,label+' frame order');assert(layout.first.x>layout.last.x,label+' control order');}
 for(const n of layout.nodes){assert(n.matrix[0]>0&&n.matrix[3]>0&&Math.abs(n.matrix[1])<1e-6&&Math.abs(n.matrix[2])<1e-6,label+' upright node '+n.id);const b=n.hit,v=layout.board;assert(b.l>=v.l-.5&&b.t>=v.t-.5&&b.r<=v.r+.5&&b.b<=v.b+.5,label+' clipped hit '+n.id+JSON.stringify({b,v}));}
 for(const item of layout.items){const b=item.box;assert(b.l>=-.5&&b.t>=-.5&&b.r<=layout.viewport[0]+.5&&b.b<=layout.viewport[1]+.5,label+' item outside '+item.id);assert(item.scroll[0]<=item.client[0]+1&&item.scroll[1]<=item.client[1]+1,label+' item scroll '+item.id);}
 if(!await page.locator('#add-controls').isHidden()){
  if(rotation===0)assert(layout.add.y<layout.zoom.y,label+' add at device top');
  if(rotation===-90)assert(layout.add.x<layout.zoom.x,label+' add remains device top/left');
  if(rotation===90)assert(layout.add.x>layout.zoom.x,label+' add remains device top/right');
 }
}
async function drag(page,from,to){const center=async id=>{const b=await page.locator(`[data-node="${id}"] .node-hit`).boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2};};const a=await center(from),b=await center(to);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up();await settle(page);}
async function exported(page){await page.locator('#menu').click();await settle(page);const target=page.getByRole('button',{name:'回路ファイルを書き出す',exact:true});for(let n=0;!await target.count();n++){assert(n<30,'Bounded fixture menu navigation');const next=page.locator('#dialog-body .pager button').last();assert(!await next.isDisabled(),'Export item exists');await next.click();await settle(page);}const [d]=await Promise.all([page.waitForEvent('download'),target.click()]),stream=await d.createReadStream(),parts=[];for await(const part of stream)parts.push(part);await page.locator('#dialog-close').click();return JSON.parse(Buffer.concat(parts).toString('utf8'));}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
 for(const engine of channel?['chromium']:['chromium','webkit']){
  const browser=await pw[engine].launch({headless:true,...(channel?{channel}:{})});report.browsers.push({engine,channel:channel||null,version:browser.version()});try{
   const context=await browser.newContext({viewport:{width:390,height:664},hasTouch:true});await context.addInitScript(()=>{window.__direction={type:'portrait-primary',angle:0};const o=new EventTarget();Object.defineProperties(o,{type:{get:()=>window.__direction.type},angle:{get:()=>window.__direction.angle}});Object.defineProperty(screen,'orientation',{get:()=>o});});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/`);await enterApp(page);await settle(page);await skipGuide(page);
   await measure(page,engine+' portrait challenge',0);await page.screenshot({path:path.join(out,engine+'-portrait.png')});
   for(const [type,angle,name] of [['landscape-primary',90,'left'],['landscape-secondary',270,'right']]){await direction(page,type,angle,844,390);await measure(page,engine+' '+name+' challenge',angle===90?-90:90);await page.screenshot({path:path.join(out,engine+'-'+name+'.png')});}
   await direction(page,'portrait-secondary',180,390,664);await measure(page,engine+' inverted portrait challenge',180);
   await drag(page,'S','A');await drag(page,'A','G');assert.equal(await page.locator('.edge:not(.candidate)').count(),2);await page.locator('#play').click();await direction(page,'portrait-primary',0,390,664);await direction(page,'landscape-primary',90,844,390);await page.waitForFunction(()=>document.getElementById('result').textContent.includes('100.00点'),{},{timeout:6500});assert((await page.locator('#result').textContent()).includes('2.5秒'));await page.locator('#stop').click();report.checks.push({label:engine+' rotation during Q1 retains run and gives 2.5s/100',passed:true});
   await direction(page,'portrait-primary',0,390,664);await page.locator('#home').click();await page.getByRole('button',{name:'自由へ',exact:true}).click();await skipGuide(page);const before=await exported(page);
   for(const [type,angle,w,h,name] of [['portrait-primary',0,390,664,'portrait'],['landscape-primary',90,844,390,'left'],['landscape-secondary',270,844,390,'right'],['landscape-primary',90,480,240,'short-left'],['landscape-secondary',270,480,240,'short-right']]){await direction(page,type,angle,w,h);await measure(page,engine+' free '+name,angle===0?0:angle===90?-90:90);assert.deepEqual((await exported(page)).circuit,before.circuit,'Rotation must retain exact raw circuit');}
   await direction(page,'portrait-primary',270,390,664);await measure(page,engine+' natural-landscape portrait=270',0);await direction(page,'landscape-primary',0,844,390);await measure(page,engine+' learned portrait=270 left',-90);await direction(page,'landscape-secondary',180,844,390);await measure(page,engine+' learned portrait=270 right',90);
   await direction(page,'portrait-primary',0,390,664);await page.locator('[data-node="A"] .node-hit').dblclick();await page.getByRole('button',{name:'時間',exact:true}).click();await page.getByRole('textbox',{name:'秒数'}).fill('0.5');await page.setViewportSize({width:390,height:240});await settle(page);assert.equal(await page.locator('html').getAttribute('data-board-rotation'),'0');assert.equal(await page.getByRole('textbox',{name:'秒数'}).inputValue(),'0.5');await page.getByRole('button',{name:'確定',exact:true}).click();report.checks.push({label:engine+' synthetic portrait keyboard shrink retains orientation and input',passed:true});
   assert.deepEqual(errors,[]);await context.close();
  }finally{await browser.close();}
 }
 report.passed=true;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(`Orientation checks passed: ${report.checks.length}`);
}catch(e){report.passed=false;report.failure=e.stack;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));throw e;}finally{await new Promise(r=>server.close(r));}})();
