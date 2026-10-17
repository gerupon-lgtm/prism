const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const origin=process.argv[2];if(!origin||new URL(origin).protocol!=='https:')throw Error('Pass HTTPS origin');
const out=path.join(__dirname,'公開',new URL(origin).hostname);fs.mkdirSync(out,{recursive:true});
const report={origin,checkedAt:new Date().toISOString(),checks:[]};
(async()=>{try{
 for(const [asset,pattern]of [['',/no-cache/],['build-info.json',/no-store/],['sw.js',/no-store/],['manifest.webmanifest',/no-cache/]]){
  const r=await fetch(new URL(asset,origin),{cache:'no-store',signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);const control=r.headers.get('cache-control');assert.match(control,pattern,asset+' caching');report.checks.push({asset,url:r.url,status:r.status,cacheControl:control});if(asset==='build-info.json')report.build=await r.json();
 }
 const asset=report.build.assets.find(x=>x.includes('/src/ui/desktop.css')),r=await fetch(new URL(asset,origin),{cache:'no-store',signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/immutable/);assert.match(r.headers.get('content-type'),/text\/css/);report.checks.push({asset,url:r.url,status:r.status,cacheControl:r.headers.get('cache-control')});
 report.passed=true;console.log('HTTPS and deployment cache checks passed: '+report.checks.length);
 }catch(error){report.passed=false;report.failure=error.stack;console.error(error);process.exitCode=1;}finally{fs.writeFileSync(path.join(out,'headers.json'),JSON.stringify(report,null,2));}})();
