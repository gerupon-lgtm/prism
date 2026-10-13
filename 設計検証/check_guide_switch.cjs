const {startAndPause}=require('./browser_wait.cjs');
const {enterApp,startGuide,skipGuide}=require('./browser_wait.cjs');
// Actual UI guide/selection flow in disposable PC browsers, not device acceptance.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {wiringBounds}=require('./browser_wait.cjs');
const arg=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),channel=arg('--channel'),root=path.resolve(__dirname,'../dist'),out=path.join(__dirname,'案内と課題切替',arg('--url')?'public':channel||'');
fs.mkdirSync(out,{recursive:true});const file=path.join(out,'report.json');
if(fs.existsSync(file)&&!JSON.parse(fs.readFileSync(file)).passed)fs.copyFileSync(file,path.join(out,'failed-'+Date.now()+'.json'));
const report={version:JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version,evidence:'Disposable PC Chromium/WebKit actual DOM actions. Not physical devices.',checks:[],browsers:[]};
const server=http.createServer((req,res)=>{let target=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(target===root)target=path.join(root,'index.html');if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',target.endsWith('.js')?'text/javascript':target.endsWith('.css')?'text/css':target.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(target));}catch{res.writeHead(404).end();}});
const settle=p=>p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...new Set([...document.querySelectorAll("#board image")].map(e=>e.getAttribute("href")))].map(async src=>{const img=new Image();img.src=src;await img.decode();}));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
const inspect=p=>p.evaluate(async()=>{const app=await import(document.querySelector('script[src*="/ui/app.js"]').src);return {run:app.inspectPerformance().run,result:document.getElementById('result').textContent,edges:[...document.querySelectorAll('#board .edge:not(.candidate)')].map(e=>e.dataset.edge),time:document.querySelector('[data-node="A"] .node-time')?.textContent};});
async function drag(page,from,to){const {a,b}=await wiringBounds(page,from,to);await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:8});await page.mouse.up();}
async function steps(page){await startAndPause(page);await page.evaluate(()=>{for(let i=0;i<30&&!document.getElementById('next').disabled;i++)document.getElementById('next').click();});await settle(page);}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
  for(const engine of channel?['chromium']:['chromium','webkit']){
    const browser=await pw[engine].launch({headless:true,...(channel?{channel}:{})});report.browsers.push({engine,channel,version:browser.version()});try{
      const context=await browser.newContext({viewport:{width:416,height:974}}),page=await context.newPage(),errors=[];
      await context.addInitScript(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(window.__failGuide&&key==='prism-notes.guides.v1')throw new DOMException('Synthetic guide save failure','QuotaExceededError');return set.call(this,key,value);};});
      page.on('pageerror',e=>errors.push(e.message));await page.goto(arg('--url')||`http://127.0.0.1:${server.address().port}/`);await enterApp(page);await settle(page);
      for(const [width,height] of [[1740,1044],[1280,800],[844,310],[416,974]]){
        await page.setViewportSize({width,height});await settle(page);
        const layout=await page.evaluate(()=>{const box=id=>{const r=document.querySelector(id).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};return {rotation:document.documentElement.dataset.boardRotation,viewport:[innerWidth,innerHeight],scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],header:box('header'),board:box('#board'),play:box('#play-controls'),source:box('[data-node="S"] .node-hit'),goal:box('[data-node="G"] .node-hit'),buttons:[...document.querySelectorAll('#play-controls button')].map(e=>({text:e.textContent,box:box('#'+e.id),width:e.clientWidth,height:e.clientHeight,sw:e.scrollWidth,sh:e.scrollHeight}))};});
        assert.equal(layout.rotation,'0');assert(layout.header.bottom<=layout.board.y+1&&layout.play.y>=layout.board.bottom-1);assert(layout.source.y>layout.goal.y);assert(layout.scroll[0]<=width+1&&layout.scroll[1]<=height+1);
        for(const item of layout.buttons){assert(item.sw<=item.width+1&&item.sh<=item.height+1);assert(item.box.x>=0&&item.box.right<=width&&item.box.y>=0&&item.box.bottom<=height);}
        if(width>=1280){assert(layout.board.width>=width*.85);await page.screenshot({path:path.join(out,`${channel||engine}-desktop-${width}.png`)});}
        report.checks.push({engine,channel,label:`Desktop header/controls upright and readable ${width}x${height}`,layout,passed:true});
      }
      await startGuide(page);assert.equal(await page.locator('#guide-skip').isVisible(),true);const original=await page.locator('#guide-text').textContent();
      await page.locator('#home').click();
      if(await page.locator('#dialog-title').textContent()==='課題と自由')await page.getByRole('button',{name:/^Q2 /}).click();
      const error=await page.locator('#dialog-error').textContent();report.checks.push({engine,label:'Guide selection has an actionable exit instead of blocked replacement',error});
      await page.screenshot({path:path.join(out,engine+'-guide-switch.png')});assert.equal(error,'');assert.equal(await page.locator('#dialog-title').textContent(),'案内を閉じますか？');report.checks.at(-1).passed=true;
      await page.getByRole('button',{name:'案内を続ける',exact:true}).click();assert.equal(await page.locator('#guide-text').textContent(),original);assert.equal(await page.locator('#guide-skip').isVisible(),true);
      await drag(page,'S','A');await drag(page,'A','G');await steps(page);assert((await page.locator('#guide-text').textContent()).startsWith('3/3'));await page.locator('#stop').click();const practice=await inspect(page);
      await page.locator('#menu').click();await page.getByRole('button',{name:'課題と自由',exact:true}).click();await page.evaluate(()=>window.__failGuide=true);await page.getByRole('button',{name:'案内を閉じて課題を選ぶ',exact:true}).click();assert((await page.locator('#dialog-error').textContent()).includes('Synthetic guide save failure'));assert.deepEqual(await inspect(page),practice);assert.equal(await page.evaluate(()=>localStorage.getItem('prism-notes.guides.v1')),null);
      await page.evaluate(()=>window.__failGuide=false);await page.getByRole('button',{name:'案内を閉じて課題を選ぶ',exact:true}).click();
      assert.equal(await page.locator('#guide-skip').isVisible(),false);assert.equal(await page.locator('#dialog-title').textContent(),'課題と自由');
      assert.equal(await page.locator('#board .edge:not(.candidate)').count(),0);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('prism-notes.guides.v1')).value.challenge),'skipped');
      await page.getByRole('button',{name:/^Q2 /}).click();assert((await page.locator('#title').textContent()).startsWith('Q2 '));assert.equal(await page.locator('#dialog-error').textContent(),'');
      report.checks.push({engine,label:'Cancel keeps guide; 3/3 guide exit survives save failure and restores original circuit before selecting Q2 without false completion',passed:true});
      await page.locator('#home').click();await page.getByRole('button',{name:'自由へ',exact:true}).click();await skipGuide(page);await page.locator('[data-node="A"] .node-hit').dblclick();await page.getByRole('button',{name:'時間',exact:true}).click();await page.getByRole('textbox',{name:'秒数'}).fill('1.5');await page.getByRole('button',{name:'確定',exact:true}).click();await steps(page);await page.locator('#menu').click();const before=await inspect(page);
      await page.getByRole('button',{name:'操作の案内',exact:true}).click();await page.locator('#home').click();await page.getByRole('button',{name:'案内を閉じて課題を選ぶ',exact:true}).click();assert.equal(await page.locator('#dialog-title').textContent(),'停止して課題を選びますか？');await page.getByRole('button',{name:'戻る',exact:true}).click();assert.deepEqual(await inspect(page),before);
      await page.locator('#home').click();await page.getByRole('button',{name:'停止して課題を選ぶ',exact:true}).click();const after=await inspect(page);assert.equal(after.run.status,'stopped');assert.equal(after.run.clock,before.run.clock);assert.equal(after.run.records,before.run.records);assert.deepEqual(after.edges,before.edges);assert.equal(after.time,before.time);
      await page.getByRole('button',{name:/^Q3 /}).click();assert.equal(await page.locator('#dialog-title').textContent(),'現在の未保存回路');await page.getByRole('button',{name:'取消',exact:true}).click();assert.deepEqual(await inspect(page),after);report.checks.push({engine,label:'Guide restores paused dirty free circuit; explicit stop preserves records and replacement retains unsaved confirmation/cancel',passed:true});
      assert.deepEqual(errors,[]);await context.close();
    }finally{await browser.close();}
  }
  report.passed=true;console.log('Guide selection checks passed: '+report.checks.length);
}catch(error){report.passed=false;report.failure=error.stack;throw error;}finally{fs.writeFileSync(file,JSON.stringify(report,null,2));server.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
