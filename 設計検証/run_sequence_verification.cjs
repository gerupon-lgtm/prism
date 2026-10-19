const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),version=JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,out=path.join(__dirname,'鐘の順番',version);fs.mkdirSync(out,{recursive:true});
const pw='C:/Users/user/Documents/あとキュー/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core';
const file=path.join(out,'verification.json'),prior=process.argv.includes('--resume')?JSON.parse(fs.readFileSync(file)):null;
if(prior&&!prior.passed)fs.copyFileSync(file,path.join(out,'failed-verification-'+Date.now()+'.json'));
const report={version,startedAt:prior?.startedAt||new Date().toISOString(),passed:false,publicVerified:false,checks:prior?.checks.filter(c=>c.exitCode===0)||[]};
function run(name,args){if(report.checks.some(c=>c.name===name)){console.log('Already passed '+name);return;}console.log('Starting '+name);const began=Date.now(),log=path.join(out,name+'.log');if(fs.existsSync(log))fs.copyFileSync(log,log+'.previous');const fd=fs.openSync(log,'w');let r;try{r=spawnSync(process.execPath,args,{cwd:root,stdio:['ignore',fd,fd],timeout:600000});}finally{fs.closeSync(fd);}report.checks.push({name,args,exitCode:r.status,milliseconds:Date.now()-began,log:path.relative(root,log)});fs.writeFileSync(file,JSON.stringify(report,null,2));if(r.status!==0)throw Error(name+' failed: '+fs.readFileSync(log,'utf8').slice(-2000));console.log(name+' passed');}
try{
 run('syntax',['scripts/check-source.js']);run('verifier-syntax',['--check','設計検証/check_sequence_set.cjs']);run('generate',['scripts/generate-random-challenges.js','--sequence-only']);run('unit',['scripts/run-tests.js']);run('build',['scripts/build.js']);
 for(const [name,option,value]of [['chromium','--engine','chromium'],['webkit','--engine','webkit'],['chrome','--channel','chrome'],['msedge','--channel','msedge']]){
  for(const [label,script,extra]of [['set','設計検証/check_sequence_set.cjs',[]],['offline','設計検証/check_sequence_set.cjs',['--offline']],['wiring','設計検証/check_wire_time_focus.cjs',[]]])run(name+'-'+label,[script,'--playwright-path',pw,option,value,...extra]);
 }
 const sources=['package.json','index.html','src/content/challenges.js','src/content/sequence-challenges.js','src/content/random-variants.js','src/core/bell-sequence.js','src/core/storage.js','src/app/session.js','src/ui/app.js','src/ui/app.css','src/ui/help.js','src/ui/scene.js','public/graphics/starecho.png','scripts/generate-sequence-challenges.js','scripts/generate-random-challenges.js','scripts/random-challenge-validation.js','設計検証/check_sequence_set.cjs','設計検証/run_sequence_verification.cjs','設計検証/browser_wait.cjs'];
 report.sourceSha256=Object.fromEntries(sources.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));report.passed=true;
}catch(error){report.error=error.stack;console.error(error.stack);process.exitCode=1;}
finally{report.finishedAt=new Date().toISOString();fs.writeFileSync(file,JSON.stringify(report,null,2));}
