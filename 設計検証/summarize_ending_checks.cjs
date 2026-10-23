const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve('設計検証/終了待機-20261024'),version=JSON.parse(fs.readFileSync('package.json')).version;
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const summary={version,passed:true,browserPlayback:[],edgeCases:[],boundary:'PC browsers, not physical phones or listening acceptance'};
for(const engine of ['chromium','webkit']){
  const r=read(`final/${engine}/report.json`);assert(r.passed);assert.equal(r.version,version);assert.equal(r.cases.length,47);assert.equal(new Set(r.cases.map(c=>c.number)).size,42);
  const waits=r.cases.map(c=>c.wall.toast.wall-c.wall.completed.wall),clears=r.cases.filter(c=>c.kind!=='failed'),failed=r.cases.filter(c=>c.kind==='failed');
  for(const c of r.cases){assert(c.passed);assert(!c.wall.toastOverFireworks);assert(c.wall.toast.wall-c.wall.completed.wall>=(c.kind==='failed'?3000:2700)-80);}
  summary.browserPlayback.push({engine,draw:engine==='webkit'?5:1,stages:42,cases:r.cases.length,clearMinimumWaitMs:Math.min(...clears.map(c=>c.wall.toast.wall-c.wall.completed.wall)),failureMinimumWaitMs:Math.min(...failed.map(c=>c.wall.toast.wall-c.wall.completed.wall)),minimumWaitMs:Math.min(...waits),maximumWaitMs:Math.max(...waits),overlap:0});
  const e=read(`edges/${engine}/report.json`);assert(e.passed);assert.equal(e.version,version);assert.equal(e.cases.length,7);assert(e.cases.some(c=>c.nextChoicePassed));assert(e.cases.some(c=>c.retryChoicePassed));
  summary.edgeCases.push({engine,cases:e.cases.map(c=>({name:c.name,waitMs:c.waitMs,audio:c.audio.filter(a=>['perfect','clear','failure'].includes(a.name)).map(a=>a.name),nextChoicePassed:c.nextChoicePassed,retryChoicePassed:c.retryChoicePassed}))});
}
fs.writeFileSync(path.join(root,'verification.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
