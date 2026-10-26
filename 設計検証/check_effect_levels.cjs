// Actual browser FM graph rendered into PCM. No physical-device listening claim.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const arg=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/user/AppData/Local/ms-playwright';
const pw=require(arg('--playwright-path')),root=path.resolve('dist'),out=path.resolve(arg('--out')||'設計検証/到達音の重なり-20261026/levels');fs.mkdirSync(out,{recursive:true});
const report={version:JSON.parse(fs.readFileSync(path.join(root,'build-info.json'))).version,url:arg('--url'),passed:false,cases:[],boundary:'Actual Chromium OfflineAudioContext and adopted FM source; controlled timing, not physical-device volume or listening.'};
const server=http.createServer((req,res)=>{try{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file===root)file=path.join(root,'index.html');assert(file.startsWith(root+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
let browser;
(async()=>{try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await pw.chromium.launch({headless:true});const p=await browser.newPage();await p.goto(arg('--url')||`http://127.0.0.1:${server.address().port}/`);assert.equal(await p.locator('meta[name="prism-version"]').getAttribute('content'),report.version);
 for(const [name,method,gap] of [['tap-separated','tap',.1],['wire-separated','wire',.2],['tap-rapid','tap',.03],['wire-rapid','wire',.05]]){
  const result=await p.evaluate(async({method,gap})=>{
   const {Chime}=await import(new URL('./audio.js',document.querySelector('script[type=module]').src));
   const raw=new OfflineAudioContext(1,48000*4,48000),ctx=new Proxy(raw,{get(target,key){if(key==='state')return 'running';if(key==='resume')return ()=>Promise.resolve();const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}}),chime=new Chime(),Audio=window.AudioContext;
   window.AudioContext=class{constructor(){return ctx;}};try{await chime.enable();}finally{window.AudioContext=Audio;}
   const times=[];for(let i=0;i<9;i++){const at=.1+i*gap;raw.suspend(at).then(()=>{times.push(raw.currentTime);chime[method]();raw.resume();});}
   const buffer=await raw.startRendering(),data=buffer.getChannelData(0);
   const rms=(at,length)=>{const lo=Math.round(at*48000),hi=Math.round((at+length)*48000);let sum=0;for(let i=lo;i<hi;i++)sum+=data[i]*data[i];return Math.sqrt(sum/(hi-lo));};
   const levels=times.map(t=>rms(t+.004,.020)),dbSpread=20*Math.log10(Math.max(...levels)/Math.min(...levels));await new Promise(resolve=>setTimeout(resolve,0));return {times,levels,dbSpread,remainingVoices:chime.voices.size};
  },{method,gap});report.cases.push({name,...result});console.log(name,result.dbSpread.toFixed(3)+'dB');
 }report.passed=report.cases.every(c=>Number.isFinite(c.dbSpread)&&c.dbSpread<.25&&c.remainingVoices===0);if(!report.passed)throw Error('Volume or voice cleanup failed: '+JSON.stringify(report.cases.filter(c=>c.dbSpread>=.25||c.remainingVoices!==0)));
}catch(error){report.error=error.stack;console.error(error.stack);process.exitCode=1;}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}})();
