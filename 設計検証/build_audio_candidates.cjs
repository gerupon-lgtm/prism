// Isolated audition materials; no game source, version or accepted bell is edited.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const arg=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),root=path.resolve(__dirname,'..'),out=path.join(__dirname,'音の候補-20261017'),audioDir=path.join(out,'audio');
const {page:previewPage}=require(path.join(out,'preview-page.cjs'));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const protectedFiles=['src/ui/audio.js','src/ui/voices.js','src/ui/end-wait.js','src/ui/app.js','index.html','package.json'];
const before=Object.fromEntries(protectedFiles.map(file=>[file,sha(fs.readFileSync(path.join(root,file)))]));
const report={checkedAt:new Date().toISOString(),evidence:'Original synthesized audition candidates. Actual OfflineAudioContext and native player checks on disposable PC browsers; not human listening or physical-device acceptance.',checks:[],pending:['Human listening and Android/iPhone/macOS/iPad acceptance. Game adoption remains unselected.'],protectedFiles:before,files:[],browsers:[]};
const check=(label,data={})=>{report.checks.push({label,passed:true,...data});console.log(label);};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.wav':'audio/wav','.json':'application/json'};
const server=http.createServer((req,res)=>{try{
 const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name==='/render'){res.setHeader('Content-Type',mime['.html']);res.end('<!doctype html><meta charset="utf-8"><title>音の書き出し</title>');return;}
 let file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',mime[path.extname(file)]??'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(file));
}catch{res.writeHead(404).end();}});
function wav(pcm,rate){
 const b=Buffer.alloc(44+pcm.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(pcm.length*2,40);for(let i=0;i<pcm.length;i++)b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,pcm[i]))*32767),44+i*2);return b;
}
function writeWav(name,bytes){
 const file=path.join(audioDir,name);fs.writeFileSync(file,bytes);const actual=fs.readFileSync(file);assert.equal(actual.toString('ascii',0,4),'RIFF');assert.equal(actual.readUInt32LE(40),actual.length-44);assert.equal(actual.readUInt32LE(24),48000);assert.equal(actual.readUInt16LE(22),1);report.files.push({name,bytes:actual.length,sha256:sha(actual)});
}
function comparison(items,context){
 const chunks=[];for(const [index,item] of items.entries()){
  const raw=fs.readFileSync(path.join(audioDir,item.id+(context?'-context':'')+'.wav')).subarray(44),repeat=context?1:2;
  for(let n=0;n<repeat;n++){chunks.push(raw);if(n<repeat-1)chunks.push(Buffer.alloc(Math.round(.26*48000)*2));}
  if(index<items.length-1)chunks.push(Buffer.alloc(Math.round((context?.4:.65)*48000)*2));
 }
 const bytes=Buffer.concat(chunks),pcm=new Float32Array(bytes.length/2);for(let i=0;i<pcm.length;i++)pcm[i]=bytes.readInt16LE(i*2)/32767;return wav(pcm,48000);
}
(async()=>{
 const {GROUPS,CANDIDATES,REVISION}=await import(pathToFileURL(path.join(out,'catalog.js')));report.version=REVISION;report.appVersion=JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version;
 fs.mkdirSync(audioDir,{recursive:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  assert.equal(CANDIDATES.length,18);for(const group of GROUPS)assert.equal(CANDIDATES.filter(item=>item.group===group.id).length,3);check('Six roles have three original candidates each');
  browser=await pw.chromium.launch({headless:true,channel:'chrome'});report.renderer={channel:'chrome',version:browser.version()};const page=await browser.newPage();await page.goto(base+'/render');
  for(const item of CANDIDATES){
   const group=GROUPS.find(group=>group.id===item.group);
   for(const withBell of group.context?[false,true]:[false]){
    const result=await page.evaluate(async({id,withBell})=>{const {renderSample}=await import('/設計検証/音の候補-20261017/render.js');return renderSample(id,withBell);},{id:item.id,withBell});
    assert(result.finite&&result.peak>.01&&result.peak<.9,item.id+' audible finite signal without clipping');assert.equal(result.tail,0);assert.equal(result.voicesRemaining,0);
    if(withBell){assert.equal(result.start,item.group==='failure'?1.5:.7);assert(result.noteEnd<(item.group==='failure'?3:2.7),item.id+' completes inside the current wait');}
    else if(!group.context)assert(result.noteEnd-result.start<.23,item.id+' short one-shot effect');
    const name=item.id+(withBell?'-context':'')+'.wav';writeWav(name,wav(result.pcm,result.rate));delete result.pcm;check(name+' renders and ends cleanly',result);
   }
  }
  await browser.close();browser=null;
  assert.equal(new Set(report.files.map(file=>file.sha256)).size,27);check('All 27 individual and bell-context WAVs are distinct and readable');
  for(const group of GROUPS)writeWav(group.id+'-comparison.wav',comparison(CANDIDATES.filter(item=>item.group===group.id),group.context));check('Six ordered comparison tracks preserve individual audio levels');
  fs.writeFileSync(path.join(out,'index.html'),previewPage({groups:GROUPS,candidates:CANDIDATES,version:REVISION}));
  const url=base+'/設計検証/音の候補-20261017/';
  for(const target of [{engine:'chromium'},{engine:'chromium',channel:'chrome'},{engine:'chromium',channel:'msedge'},{engine:'webkit'}]){
   browser=await pw[target.engine].launch({headless:true,...(target.channel?{channel:target.channel}:{})});const label=target.channel??target.engine;report.browsers.push({...target,version:browser.version()});
   const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(url);assert.equal(await page.locator('audio').count(),3);
   for(const group of GROUPS){await page.locator('nav button[data-group="'+group.id+'"]').click();assert.equal(await page.locator('article').count(),3);assert.equal(await page.locator('#context').isHidden(),!group.context);}
   for(const size of [{width:320,height:568},{width:390,height:844},{width:844,height:390}]){await page.setViewportSize(size);const layout=await page.evaluate(()=>({width:innerWidth,height:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight}));assert(layout.sw<=layout.width&&layout.sh<=layout.height,label+' page viewport containment');}
   check(label+' all six groups and narrow/landscape layouts work');
   await page.locator('nav button[data-group="perfect"]').click();await page.waitForTimeout(250);
   const media=await page.evaluate(async()=>{
    const audios=[...document.querySelectorAll('audio')];await Promise.all(audios.map(a=>a.readyState?Promise.resolve():new Promise(resolve=>{a.addEventListener('loadedmetadata',resolve,{once:true});a.addEventListener('error',resolve,{once:true});setTimeout(resolve,2500);})));return audios.map(a=>({duration:a.duration,ready:a.readyState,error:a.error?.code}));
   });
   if(media.every(item=>Number.isFinite(item.duration)&&item.duration>0)){
    const played=await page.evaluate(async()=>{const a=[...document.querySelectorAll('audio')];await a[0].play();await new Promise(r=>setTimeout(r,100));await a[1].play();return {firstPaused:a[0].paused,firstTime:a[0].currentTime,secondPaused:a[1].paused};});assert(played.firstPaused&&played.firstTime===0&&!played.secondPaused);
    await page.locator('#context').click();assert((await page.locator('audio').first().getAttribute('src')).includes('F1.wav'));await page.evaluate(()=>document.querySelector('audio').play());await page.locator('nav button[data-group="tap"]').click();assert(await page.locator('audio').evaluateAll(a=>a.every(item=>item.paused)));
    check(label+' WAV metadata, exclusive playback and switching stop correctly',{media});
   }else if(target.engine==='webkit'){report.pending.push({label,reason:'Native WAV playback is unavailable in this Windows WebKit build; actual Safari/phone playback remains included and unconfirmed.',media});}
   else throw Error(label+' WAV metadata unavailable: '+JSON.stringify(media));
   if(label==='chrome'){
    await page.goto(pathToFileURL(path.join(out,'index.html')).href);await page.waitForFunction(()=>Number.isFinite(document.querySelector('audio')?.duration),null,{timeout:5000});
    await page.locator('nav button[data-group="perfect"]').click();await page.evaluate(()=>document.querySelector('audio').play());assert.equal(await page.locator('audio').first().evaluate(a=>a.paused),false);
    check('Chrome extracted local-file preview plays without a server');
   }
   assert.deepEqual(errors,[]);await browser.close();browser=null;
  }
  for(const file of protectedFiles)assert.equal(sha(fs.readFileSync(path.join(root,file))),before[file],file+' unchanged');check('Accepted bell, game source, app version and timing remain unchanged');
  report.passed=true;console.log('Audio candidate checks passed: '+report.checks.length);
 }catch(error){report.passed=false;report.failure=error.stack;process.exitCode=1;console.error(error.stack);}
 finally{if(browser)await browser.close();server.close();fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));}
})();
