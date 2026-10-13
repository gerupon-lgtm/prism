// Actual app interactions on PC engines. This does not claim physical-device evidence.
const fs=require('node:fs');const path=require('node:path');const http=require('node:http');const assert=require('node:assert/strict');
function arg(name){const index=process.argv.indexOf(name);return index<0?null:process.argv[index+1];}
const library=arg('--playwright-path');if(!library)throw new Error('Pass --playwright-path');
process.env.PLAYWRIGHT_BROWSERS_PATH=arg('--browser-cache')||'C:/Users/user/AppData/Local/ms-playwright';
const channel=arg('--channel');if(channel&&!['chrome','msedge'].includes(channel))throw new Error('Use --channel chrome or msedge');
const pw=require(path.resolve(library)),root=path.resolve(__dirname,'../dist'),out=path.join(__dirname,'アプリ',channel||'');fs.mkdirSync(out,{recursive:true});
const report={version:JSON.parse(fs.readFileSync(path.join(__dirname,'../package.json'),'utf8')).version,evidence:'PC Chromium/WebKit only. Real app actions with emulated viewport sizes. No real device or public deployment evidence.',checks:[]};
if(channel)report.evidence=`Installed Windows ${channel}. Disposable browser context and emulated viewports; no phone, touch, or public deployment evidence.`;
report.browsers=[];
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.ttf':'font/ttf','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((request,response)=>{
  const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);let file=path.resolve(root,'.'+pathname);
  if(file!==root&&!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}if(file===root)file=path.join(root,'index.html');
  try{response.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');response.setHeader('Cache-Control','no-store');response.end(fs.readFileSync(file));}catch{response.writeHead(404).end();}
});
async function settle(page){await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});}
async function fit(page,label){
  await settle(page);
  const measure=await page.evaluate(()=>{
    const visible=element=>element.getClientRects().length&&getComputedStyle(element).visibility!=='hidden';
    const elements=[...document.querySelectorAll('header,#workspace,#stage,#records-panel,#result,#guide-bar,#play-controls,footer,dialog[open],dialog[open] form,dialog[open] #dialog-body,dialog[open] #dialog-actions,button,input,select')].filter(visible);
    return {viewport:[innerWidth,innerHeight],document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],items:elements.map(element=>{
      const rect=element.getBoundingClientRect();return {name:element.id||element.textContent.slice(0,35),rect:[rect.left,rect.top,rect.right,rect.bottom],client:[element.clientWidth,element.clientHeight],scroll:[element.scrollWidth,element.scrollHeight],fullStatus:element.id==='result'?element.textContent:null};
    })};
  });
  try{
    assert(measure.document[0]<=measure.viewport[0]&&measure.document[1]<=measure.viewport[1],`${label}: document scroll ${JSON.stringify(measure.document)}`);
    for(const item of measure.items){const [l,t,r,b]=item.rect;assert(l>=-.5&&t>=-.5&&r<=measure.viewport[0]+.5&&b<=measure.viewport[1]+.5,`${label}: out of viewport ${item.name} ${JSON.stringify(item.rect)}`);assert((item.name==='result'||item.scroll[0]<=item.client[0]+1)&&item.scroll[1]<=item.client[1]+1,`${label}: hidden/scroll content ${item.name} ${JSON.stringify(item)}`);}
  }catch(error){report.failureLayout={label,...measure};await page.screenshot({path:path.join(out,'failed-layout.png')});throw error;}
  const status=measure.items.find(item=>item.name==='result'&&item.scroll[0]>item.client[0]+1);
  if(status&&!await page.locator('#dialog').evaluate(e=>e.open)){
    await page.locator('#result-info').click();await settle(page);let full='';
    for(let i=0;i<30;i++){full+=(await page.locator('#dialog-body .detail-value').allTextContents()).join('');const next=page.locator('#dialog-body .pager button').last();if(await next.isDisabled())break;await next.click();await settle(page);}
    assert.equal(full,status.fullStatus,label+' status available in full');await page.locator('#dialog-close').click();measure.statusFullTextVerified=true;
  }
  report.checks.push({label,...measure});
}
async function drag(page,from,to){
  const center=async id=>{const box=await page.locator(`[data-node="${id}"] .node-hit`).boundingBox();return {x:box.x+box.width/2,y:box.y+box.height/2};};
  const a=await center(from),b=await center(to);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up();await settle(page);
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}/`;
  try{
    for(const engine of channel?['chromium']:['chromium','webkit']){
      const browser=await pw[engine].launch({headless:true,...(channel?{channel}:{})});report.browsers.push({engine,channel:channel||null,version:browser.version()});
      try{
        const page=await browser.newPage({viewport:{width:390,height:664}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
        await page.goto(url);await settle(page);await page.locator('#guide-skip').click();
        for(const [width,height] of [[320,480],[360,640],[390,664],[480,240],[568,260],[844,310],[768,1024],[1280,800]]){
          await page.setViewportSize({width,height});await fit(page,`${engine} play ${width}x${height}`);
          await page.locator('#home').click();await fit(page,`${engine} choices ${width}x${height}`);await page.locator('#dialog-close').click();
          const orientation=await page.locator('html').getAttribute('data-board-rotation');
          await page.locator('#records').click();await fit(page,`${engine} records ${width}x${height}`);assert.equal(await page.locator('html').getAttribute('data-board-rotation'),orientation,'Records must not rotate the device frame');await page.locator('#close-records').click();
        }
        await page.setViewportSize({width:390,height:664});await settle(page);
        await drag(page,'S','A');await drag(page,'A','G');assert.equal(await page.locator('.edge:not(.candidate)').count(),2);
        await page.evaluate(()=>{window.__prismStorageWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='prism-notes.scores.v1')throw new DOMException('Synthetic quota failure','QuotaExceededError');return window.__prismStorageWrite.call(this,key,value);};});
        await page.locator('#play').click();await page.waitForFunction(()=>document.getElementById('result').textContent.includes('100.00点'),{},{timeout:6000});
        assert(await page.locator('#retry-result').isVisible());await page.locator('#retry-result').click();assert((await page.locator('#result').textContent()).includes('100.00点'));await fit(page,`${engine} score failure inline`);
        await page.evaluate(()=>{Storage.prototype.setItem=window.__prismStorageWrite;delete window.__prismStorageWrite;});await page.locator('#retry-result').click();assert(!(await page.locator('#retry-result').isVisible()));
        await page.locator('#records').click();assert(await page.locator('#record-page').textContent().then(text=>!text.includes('全0件')));await fit(page,`${engine} populated records`);
        await page.locator('#record-next').click();await page.locator('#record-list button').first().click();await fit(page,`${engine} record detail`);await page.locator('#dialog-close').click();
        await page.locator('#close-records').click();await page.locator('#stop').click();
        await page.locator('#home').click();await page.getByRole('button',{name:'自由へ',exact:true}).click();await page.locator('#guide-skip').click();
        await page.locator('[data-node="A"] .node-hit').dblclick();await page.getByRole('button',{name:'時間',exact:true}).click();
        await page.getByRole('button',{name:'＋0.1',exact:true}).click();await page.getByRole('button',{name:'取消',exact:true}).click();assert.equal(await page.locator('[data-node="A"] .node-time').textContent(),'0.5s');
        await page.locator('[data-node="A"] .node-hit').dblclick();await page.getByRole('button',{name:'時間',exact:true}).click();
        await page.getByRole('textbox',{name:'秒数'}).fill('0.15');await page.getByRole('button',{name:'確定',exact:true}).click();assert((await page.locator('#dialog-error').textContent()).includes('0.1秒'));
        for(const [width,height]of [[320,480],[480,240]]){await page.setViewportSize({width,height});await fit(page,`${engine} invalid time ${width}x${height}`);assert.equal(await page.getByRole('textbox',{name:'秒数'}).inputValue(),'0.15');}
        await page.getByRole('textbox',{name:'秒数'}).fill('1.5');await page.getByRole('button',{name:'確定',exact:true}).click();
        await page.setViewportSize({width:390,height:664});await page.locator('#play').click();await page.waitForFunction(()=>document.getElementById('result').textContent.includes('3秒')&&document.getElementById('result').textContent.includes('終了'),{},{timeout:6500});await page.locator('#stop').click();
        await page.locator('#menu').click();await page.getByRole('button',{name:'回路を保存',exact:true}).click();await page.getByRole('textbox',{name:'回路名'}).fill('<script>保存名</script>');await page.getByRole('button',{name:'保存',exact:true}).click();
        const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('prism-notes.circuits.v1')));assert.equal(saved.value.length,1);assert.equal(saved.value[0].name,'<script>保存名</script>');
        const coordinates=await page.locator('[data-node="A"]').getAttribute('transform');await page.setViewportSize({width:844,height:310});await settle(page);const rotated=await page.locator('[data-node="A"]').getAttribute('transform');const savedNodes=await page.evaluate(()=>JSON.parse(localStorage.getItem('prism-notes.circuits.v1')).value[0].circuit.nodes);assert.deepEqual(savedNodes.find(node=>node.id==='A'),{id:'A',kind:'prism',x:.25,y:.45,process:'1.5'});assert(/translate\([^ ]+ 880\)/.test(coordinates)&&/translate\([^ ]+ 880\)/.test(rotated));assert(rotated.includes('rotate(0)'));assert.equal(await page.locator('html').getAttribute('data-board-rotation'),'0');
        await fit(page,`${engine} orientation retains coordinates`);await page.screenshot({path:path.join(out,`${engine}-landscape.png`)});
        await page.setViewportSize({width:390,height:664});await settle(page);await page.screenshot({path:path.join(out,`${engine}-portrait.png`)});
        await page.locator('#menu').click();await page.getByRole('button',{name:'回路を保存',exact:true}).click();await page.getByRole('textbox',{name:'回路名'}).fill('長い回路名'.repeat(150));await page.getByRole('button',{name:'保存',exact:true}).click();await page.setViewportSize({width:320,height:480});await fit(page,`${engine} long saved name`);
        const overlapping={format:'prism-notes-circuit',version:1,name:'座標重複と逆向き平行道',circuit:{mode:'spread',target:'all',nodes:[{id:'S',kind:'source',x:0.5,y:0.1,process:'0.5'},{id:'A',kind:'prism',x:0.5,y:0.1,process:'0'},{id:'B',kind:'prism',x:0.7,y:0.5,process:'0'},{id:'G',kind:'goal',x:0.5,y:0.9,process:'0'}],edges:[{id:'SA',from:'S',to:'A',time:'1'},{id:'AB',from:'A',to:'B',time:'1'},{id:'BA',from:'B',to:'A',time:'1'}]}};
        await page.locator('#import').setInputFiles({name:'circuit.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(overlapping))});await settle(page);
        const paths=await page.locator('.edge-line').evaluateAll(items=>items.map(item=>item.getAttribute('d')));assert(paths.every(d=>!d.includes('NaN')));assert.notEqual(paths[1].match(/Q[^ ]+/)[0],paths[2].match(/Q[^ ]+/)[0]);
        const extreme=structuredClone(overlapping);extreme.circuit.nodes[0].x=Number.MAX_VALUE;extreme.name='大きい有限座標';
        await page.locator('#import').setInputFiles({name:'large.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(extreme))});await settle(page);await page.locator('#fit').click();
        const extremePaths=await page.locator('.edge-line').evaluateAll(items=>items.map(item=>item.getAttribute('d')));assert(extremePaths.every(d=>!d.includes('NaN')&&!d.includes('Infinity')));await fit(page,`${engine} finite projection of extreme coordinates`);
        await page.evaluate(()=>{const key='prism-notes.circuits.v1',data=JSON.parse(localStorage.getItem(key));while(data.value.length<10)data.value.push({...data.value[0],id:'fixture-'+data.value.length});localStorage.setItem(key,JSON.stringify(data));});
        await page.locator('#menu').click();await page.getByRole('button',{name:'回路を保存',exact:true}).click();await page.getByRole('textbox',{name:'回路名'}).fill('長い名前'.repeat(150));await page.getByRole('button',{name:'保存',exact:true}).click();await fit(page,`${engine} full slots with long draft name`);await page.getByRole('button',{name:'取消',exact:true}).click();assert.equal(await page.getByRole('textbox',{name:'回路名'}).inputValue(),'長い名前'.repeat(150));await page.locator('#dialog-close').click();
        report.checks.push({label:`${engine} same-coordinate points/reverse parallel edges/cancel retains time/inline score retry/long name`,passed:true});
        assert.deepEqual(errors,[]);report.checks.push({label:`${engine} actual drag/run/edit/save/rotation`,passed:true});
      }finally{await browser.close();}
    }
    report.passed=true;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(`App checks passed: ${report.checks.length}`);
  }catch(error){report.passed=false;report.failure=error.stack;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));throw error;}
  finally{await new Promise(resolve=>server.close(resolve));}
})();
