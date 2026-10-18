// Sequential bounded verification: no browser/test batches run concurrently.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),version=JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,out=path.join(__dirname,'テーマ課題',version);fs.mkdirSync(out,{recursive:true});
const at=process.argv.indexOf('--playwright-path');if(at<0)throw Error('Pass --playwright-path');const pw=process.argv[at+1];
const checks=[['syntax','scripts/check-source.js'],['generate','scripts/generate-random-challenges.js'],['unit','scripts/run-tests.js'],['build','scripts/build.js']];
for(const target of ['chrome','msedge','chromium','webkit']){
 const flags=['--playwright-path',pw,...(['chrome','msedge'].includes(target)?['--channel',target]:['--engine',target])];
 for(const [name,file,extra] of [['sets','check_themed_sets.cjs',[]],['offline','check_themed_sets.cjs',['--offline']],['wiring','check_wire_time_focus.cjs',[]],['latency','check_audio_latency.cjs',[]]])checks.push([target+'-'+name,'設計検証/'+file,...flags,...extra]);
}
const report={version,startedAt:new Date().toISOString(),passed:false,publicVerified:false,checks:[],evidence:'Sequential Node tests and disposable PC browser checks; physical-device listening/operation and difficulty remain pending.'};
try{
 for(const [name,...args] of checks){
  const start=Date.now(),log=path.join(out,name+'.log'),fd=fs.openSync(log,'w');console.log('Starting '+name);
  let r;try{r=spawnSync(process.execPath,args,{cwd:root,stdio:['ignore',fd,fd],timeout:600000});}finally{fs.closeSync(fd);}
  report.checks.push({name,args,exitCode:r.status,milliseconds:Date.now()-start,log:path.relative(root,log)});fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));
  if(r.status!==0)throw Error(name+' failed: '+fs.readFileSync(log,'utf8').slice(-3000));console.log('Passed '+name+' ('+Math.round((Date.now()-start)/1000)+'s)');
 }
 const protectedSources=['package.json','index.html','src/content/challenges.js','src/content/themed-challenges.js','src/content/random-variants.js','src/content/bell-pitches.js','src/ui/audio.js','src/ui/voices.js','src/ui/app.js','src/ui/scene.js','public/graphics/starwalk.png','public/graphics/moonwater.png'];
 report.sha256=Object.fromEntries(protectedSources.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));report.passed=true;report.finishedAt=new Date().toISOString();
 const wiring=report.checks.filter(c=>c.name.endsWith('-wiring'));fs.writeFileSync(path.join(out,'wiring-regression.json'),JSON.stringify({version,passed:wiring.length===4&&wiring.every(c=>c.exitCode===0),checks:wiring},null,2));
}catch(e){report.failure=e.stack;console.error(e.stack);process.exitCode=1;}finally{fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));}
