// Player-facing labels and thumb controls. PC evidence, not physical phones.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {enterApp,wiringBounds}=require('./browser_wait.cjs');
const arg=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),root=path.resolve(__dirname,'../dist'),out=path.join(__dirname,'プレイ操作',arg('--url')?'public':arg('--channel')||'');fs.mkdirSync(out,{recursive:true});
const report={version:JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version,evidence:'Disposable PC browsers, synthetic phone viewports/orientation/CSS28. Scores are synthetic via the actual persistence API. Not physical phone reachability.',checks:[],browsers:[]};
const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.ttf':'font/ttf'};
const server=http.createServer((req,res)=>{let f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(f===root)f=path.join(root,'index.html');if(!f.startsWith(root+path.sep)){res.writeHead(404).end();return;}try{res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));}catch{res.writeHead(404).end();}});
async function settle(page){await page.evaluate(async()=>{await document.fonts.ready;for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);});}
async function cards(page,label){
 const seen=[];
 do{
  await settle(page);const rows=await page.locator('.challenge-row').evaluateAll(items=>items.map(row=>{
   const parts=[row,...row.querySelectorAll('.challenge-name,.challenge-score')].map(e=>{const r=e.getBoundingClientRect();return {rect:[r.left,r.top,r.right,r.bottom],size:[e.clientWidth,e.clientHeight,e.scrollWidth,e.scrollHeight],overflow:getComputedStyle(e).textOverflow};});
   return {id:row.dataset.challenge,text:row.textContent,parts};
  }));
  assert(rows.length>0,label+' has selectable challenges');
  for(const row of rows){assert(row.text.includes('100.00点')&&!row.text.includes('…'),label+' complete name and score');for(const p of row.parts){assert(p.size[2]<=p.size[0]+1&&p.size[3]<=p.size[1]+1,label+' full text fits '+row.id);assert(p.rect[0]>=0&&p.rect[1]>=0&&p.rect[2]<=page.viewportSize().width+1&&p.rect[3]<=page.viewportSize().height+1,label+' card in viewport');}seen.push(row.id);}
  const next=page.locator('#dialog-body .pager button').last();if(await next.isDisabled())break;await next.click();
 }while(seen.length<24);
 assert.equal(new Set(seen).size,12,label+' all twelve remain reachable');report.checks.push({label,passed:true,seen});
}
async function select(page,id){await enterApp(page);await page.locator('#home').click();while(!await page.getByRole('button',{name:new RegExp('^'+id+' ')}).count())await page.locator('#dialog-body .pager button').last().click();await page.getByRole('button',{name:new RegExp('^'+id+' ')}).click();}
async function layout(page,label){await settle(page);const v=await page.evaluate(()=>{
 const box=id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return {id,text:e.textContent,rect:[r.left,r.top,r.right,r.bottom],size:[e.clientWidth,e.clientHeight,e.scrollWidth,e.scrollHeight]};};
 return {viewport:[innerWidth,innerHeight],scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],rotation:Number(document.documentElement.dataset.boardRotation),logo:box('home'),controls:['play','stop','next','records','sound','menu',...(document.getElementById('update-notice').hidden?[]:['update-notice'])].map(box),header:box('condition-info'),board:box('board')};
});report.checks.push({label,...v,passed:false});assert(v.scroll.every((n,i)=>n<=v.viewport[i]+1),label+' document fit');
 for(const c of v.controls){const [l,t,r,b]=c.rect;assert(l>=-.5&&t>=-.5&&r<=v.viewport[0]+.5&&b<=v.viewport[1]+.5,label+' on screen '+c.id);assert(c.size[2]<=c.size[0]+1&&c.size[3]<=c.size[1]+1,label+' full label '+c.id);}
 const [play,stop,next,records,sound]=v.controls;
 const area=c=>(c.rect[2]-c.rect[0])*(c.rect[3]-c.rect[1]);assert(area(play)>area(records)*1.5&&area(play)>area(sound)*1.5,label+' primary control gets more area');
 if(v.rotation===0){assert(play.rect[1]>v.board.rect[1]&&records.rect[3]<=v.board.rect[1]+1&&sound.rect[3]<=v.board.rect[1]+1,label+' frequent bottom / occasional header');assert((play.rect[0]+play.rect[2])/2>v.viewport[0]*.3&&(play.rect[0]+play.rect[2])/2<v.viewport[0]*.7,label+' play stays near center');if(v.viewport[1]>=600)assert(play.rect[3]-play.rect[1]>=52,label+' primary target at least 52px');}
 if(v.rotation===0&&v.viewport[0]>=375&&v.viewport[1]>=600)assert(v.logo.rect[2]-v.logo.rect[0]>=99.9&&v.logo.rect[3]-v.logo.rect[1]>=43.9,label+' keep the adopted logo at its usual size when space allows');
 report.checks.at(-1).passed=true;}
async function notice(page,label){await page.locator('#update-notice').evaluate(e=>e.hidden=false);await layout(page,label+' prepared-update geometry');await page.locator('#update-notice').evaluate(e=>e.hidden=true);}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{for(const engine of arg('--channel')?['chromium']:['chromium','webkit']){
 const browser=await pw[engine].launch({headless:true,...(arg('--channel')?{channel:arg('--channel')}:{})});report.browsers.push({engine,channel:arg('--channel'),version:browser.version()});try{
 const context=await browser.newContext({viewport:{width:393,height:740},hasTouch:true,isMobile:true});await context.addInitScript(()=>{window.__direction={angle:0,type:'portrait-primary'};const o=new EventTarget();Object.defineProperties(o,{angle:{get:()=>__direction.angle},type:{get:()=>__direction.type}});Object.defineProperty(screen,'orientation',{get:()=>o});});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(arg('--url')||`http://127.0.0.1:${server.address().port}/`);
 assert.equal(await page.locator('meta[name=prism-version]').getAttribute('content'),report.version);
 await page.evaluate(async()=>{const entry=document.querySelector('script[src*="/ui/app.js"]').src,{LocalRecords}=await import(new URL('../core/storage.js',entry)),{challenges}=await import(new URL('../content/challenges.js',entry)),records=new LocalRecords(localStorage);for(const c of challenges)records.saveScore(c.id+'@'+c.version,c.type+'@1',{numerator:'100',denominator:'1'});});
 await page.locator('#title-challenges').click();const score=await page.getByRole('button',{name:/^Q3 /}).textContent();await page.screenshot({path:path.join(out,engine+'-challenge-list.png')});assert(score.includes('100.00点'),'Q3 score must be fully visible, not character-truncated');
 report.checks.push({label:engine+' challenge name and 100.00-point score are full text',passed:true});await page.locator('#dialog-close').click();
 if(process.argv.includes('--smoke'))continue;
 for(const [w,h,font] of [[393,740,''],[320,480,''],[480,240,'28px']]){await page.setViewportSize({width:w,height:h});await page.evaluate(font=>{document.documentElement.style.fontSize=font;window.dispatchEvent(new Event('resize'));},font);await page.locator('#title-challenges').click();await cards(page,engine+' complete scored list '+w+'x'+h+' font='+font);await page.locator('#dialog-close').click();}
 await page.evaluate(()=>{document.documentElement.style.fontSize='';window.dispatchEvent(new Event('resize'));});await page.setViewportSize({width:393,height:740});
 await enterApp(page);assert.equal(await page.locator('#play').textContent(),'鐘を鳴らす');await layout(page,engine+' portrait controls');await notice(page,engine+' portrait');await page.screenshot({path:path.join(out,engine+'-portrait.png')});
 for(const [w,h,type,angle] of [[320,480,'portrait-primary',0],[844,390,'landscape-primary',90],[844,390,'landscape-secondary',270],[393,740,'portrait-primary',0]]){await page.evaluate(v=>Object.assign(__direction,v),{type,angle});await page.setViewportSize({width:w,height:h});await page.evaluate(()=>screen.orientation.dispatchEvent(new Event('change')));await layout(page,engine+' controls '+w+'x'+h+' '+angle);}
 assert.equal(await page.locator('[data-node="G"] .node-name').textContent(),'鐘');assert.equal(await page.locator('[data-node="S"] .node-name').textContent(),'星');
 await page.locator('#condition-info').click();assert(!/\bG\d?\b/.test(await page.locator('#dialog-body').textContent()),'Explanation names the bell, not developer IDs');await page.locator('#dialog-close').click();
 await select(page,'Q7');assert((await page.locator('#challenge-goal').textContent()).includes('鐘1'));assert((await page.locator('#challenge-goal').textContent()).includes('鐘2'));report.checks.push({label:engine+' graph and explanations use star/bell names with stable identifiers',passed:true});
 await page.locator('#records').click();assert(await page.locator('#records-panel').isVisible());await page.locator('#close-records').click();report.checks.push({label:engine+' header records remains functional',passed:true});
 await page.evaluate(()=>{document.documentElement.style.fontSize='28px';window.dispatchEvent(new Event('resize'));});await layout(page,engine+' CSS28 portrait');
 for(const [w,h,type,angle] of [[844,390,'landscape-primary',90],[844,390,'landscape-secondary',270],[480,240,'portrait-primary',0]]){await page.evaluate(v=>Object.assign(__direction,v),{type,angle});await page.setViewportSize({width:w,height:h});await page.evaluate(()=>screen.orientation.dispatchEvent(new Event('change')));await layout(page,engine+' CSS28 '+w+'x'+h+' '+angle);await notice(page,engine+' CSS28 '+w+'x'+h+' '+angle);}
 assert.deepEqual(errors,[]);await context.close();
 }finally{await browser.close();}
 }report.passed=true;console.log('Player controls checks passed: '+report.checks.length);}catch(e){report.passed=false;report.failure=e.stack;throw e;}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
