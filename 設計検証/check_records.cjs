// Actual navigation on PC engines and installed Windows browsers; no phone evidence.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const arg=name=>{const at=process.argv.indexOf(name);return at<0?null:process.argv[at+1];};
if(!arg('--playwright-path'))throw new Error('Pass --playwright-path');
process.env.PLAYWRIGHT_BROWSERS_PATH=arg('--browser-cache')||'C:/Users/user/AppData/Local/ms-playwright';
const pw=require(path.resolve(arg('--playwright-path'))),root=path.resolve(__dirname,'../dist'),out=path.join(__dirname,'記録の関係');fs.mkdirSync(out,{recursive:true});
const report={version:JSON.parse(fs.readFileSync(path.join(__dirname,'../package.json'),'utf8')).version,checkedAt:new Date().toISOString(),evidence:'Actual app navigation with a synthetic two-generation branch circuit. PC Chromium/WebKit and installed Windows Chrome/Edge. No physical phone evidence.',checks:[],pending:[]};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.ttf':'font/ttf','.json':'application/json','.webmanifest':'application/manifest+json'};
const server=http.createServer((request,response)=>{
  let file=path.resolve(root,'.'+decodeURIComponent(new URL(request.url,'http://localhost').pathname));
  if(file!==root&&!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}if(file===root)file=path.join(root,'index.html');
  try{response.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');response.setHeader('Cache-Control','no-store');response.end(fs.readFileSync(file));}catch{response.writeHead(404).end();}
});
const circuit={mode:'spread',target:'all',nodes:[{id:'S',kind:'source',process:'0',x:.5,y:.08},{id:'A',kind:'prism',process:'0',x:.5,y:.3},{id:'B',kind:'prism',process:'0',x:.25,y:.55},{id:'C',kind:'prism',process:'0',x:.75,y:.55},{id:'G1',kind:'goal',process:'0',x:.3,y:.88},{id:'G2',kind:'goal',process:'0',x:.7,y:.88}],edges:[['SA','S','A'],['AB','A','B'],['AC','A','C'],['BG1','B','G1'],['CG1','C','G1'],['CG2','C','G2']].map(([id,from,to])=>({id,from,to,time:'0.1'}))};
const settle=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
async function select(page,name,area='#dialog-body',nextSelector='#dialog-body .pager button:last-child'){
  for(let i=0;i<100;i++){
    const target=page.locator(area).getByRole('button',{name,exact:typeof name==='string'});if(await target.count()){await target.first().click();await settle(page);return;}
    const next=page.locator(nextSelector);assert(!(await next.isDisabled()),`Missing ${name} in ${await page.locator(area).innerText()}`);await next.click();await settle(page);
  }throw new Error(`Fixture navigation did not find ${name}`);
}
async function fits(page){
  const values=await page.evaluate(()=>{const view=[innerWidth,innerHeight],documentSize=[document.documentElement.scrollWidth,document.documentElement.scrollHeight];const rect=document.querySelector('dialog[open]')?.getBoundingClientRect();return {view,documentSize,dialog:rect?[rect.left,rect.top,rect.right,rect.bottom]:null};});
  assert(values.documentSize[0]<=values.view[0]&&values.documentSize[1]<=values.view[1]);if(values.dialog)assert(values.dialog[0]>=0&&values.dialog[1]>=0&&values.dialog[2]<=values.view[0]&&values.dialog[3]<=values.view[1]);return values;
}
(async()=>{
  const {Simulation}=await import(pathToFileURL(path.join(__dirname,'../src/core/simulation.js')).href),reference=new Simulation(circuit);reference.advanceUntil('1');
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}/`;
  const configurations=[{name:'chromium',type:pw.chromium,options:{}},{name:'webkit',type:pw.webkit,options:{}},{name:'windows-chrome',type:pw.chromium,options:{channel:'chrome'},executable:'C:/Program Files/Google/Chrome/Application/chrome.exe'},{name:'windows-edge',type:pw.chromium,options:{channel:'msedge'},executable:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}];
  try{
    for(const config of configurations){
      if(config.executable&&!fs.existsSync(config.executable)){report.pending.push({browser:config.name,reason:'Not installed'});continue;}
      const browser=await config.type.launch({headless:true,...config.options});
      try{
        const page=await browser.newPage({viewport:{width:390,height:664},acceptDownloads:true}),errors=[];page.on('pageerror',error=>errors.push(error.message));
        await page.goto(url);await page.locator('#guide-skip').click();await page.locator('#home').click();await page.getByRole('button',{name:'自由へ',exact:true}).click();await page.locator('#guide-skip').click();
        await page.locator('#import').setInputFiles({name:'branch-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'prism-notes-circuit',version:1,name:'合成の二世代分岐',circuit}))});await settle(page);
        await page.locator('#play').click();await page.waitForFunction(()=>document.getElementById('result').textContent.includes('到着・動作終了'));await page.locator('#stop').click();await page.locator('#records').click();
        await select(page,/^0\.2s #4 移動$/,'#record-list','#record-next');const originalPage=await page.locator('#record-page').textContent();
        await select(page,'親の光線：3');assert.equal(await page.locator('#dialog-title').textContent(),'光線 #3の記録');
        await select(page,/^0\.2s 分岐 C$/);await select(page,'親の光線：1');assert.equal(await page.locator('#dialog-title').textContent(),'光線 #1の記録');
        await select(page,/^0\.1s 分岐 A$/);await select(page,'分岐後の光線：2');assert.equal(await page.locator('#dialog-title').textContent(),'光線 #2の記録');
        report.checks.push({label:`${config.name} stopped-run child→parent→grandparent→child navigation`,browserVersion:browser.version(),passed:true});
        await select(page,/^0\.3s チャイム G1$/);await select(page,'光線番号：2');assert.equal(await page.locator('#dialog-title').textContent(),'光線 #2の記録');
        await page.getByRole('button',{name:'戻る',exact:true}).click();assert.equal(await page.locator('#dialog-title').textContent(),'記録の詳細');
        await page.getByRole('button',{name:'戻る',exact:true}).click();assert.equal(await page.locator('#dialog-title').textContent(),'光線 #2の記録');
        for(const [width,height]of [[320,480],[480,240],[844,310],[768,1024]]){await page.setViewportSize({width,height});await settle(page);report.checks.push({label:`${config.name} lineage list ${width}x${height}`,passed:true,...await fits(page)});}
        await page.setViewportSize({width:390,height:664});await settle(page);await page.screenshot({path:path.join(out,`${config.name}.png`)});
        await page.locator('#dialog-close').click();assert.equal(await page.locator('#record-page').textContent(),originalPage);report.checks.push({label:`${config.name} main record page retained after related-record navigation`,passed:true});
        await page.locator('#close-records').click();await page.locator('#menu').click();await settle(page);const download=page.waitForEvent('download');await select(page,'実行結果を書き出す');const data=JSON.parse(fs.readFileSync(await (await download).path(),'utf8'));assert.deepEqual(data.records,reference.records);assert.equal(data.status,'stopped');assert.equal(data.records.filter(item=>item.type==='goal').length,3);
        report.checks.push({label:`${config.name} all full records and parent-child data remain identical after navigation`,records:data.records.length,passed:true});assert.deepEqual(errors,[]);
      }finally{await browser.close();}
    }
    report.passed=true;console.log(`Record relation checks passed: ${report.checks.length}`);
  }catch(error){report.passed=false;report.failure=error.stack;throw error;}
  finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
