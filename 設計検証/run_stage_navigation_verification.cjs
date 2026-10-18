const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),version=JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,out=path.join(__dirname,'面の移動',version);fs.mkdirSync(out,{recursive:true});
const pw='C:/Users/user/Documents/あとキュー/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core';
const report={version,startedAt:new Date().toISOString(),passed:false,publicVerified:false,checks:[]};
const sources=['index.html','package.json','src/ui/app.js','src/ui/app.css','src/ui/desktop.css','src/ui/desktop-layout.js','設計検証/check_stage_navigation.cjs','設計検証/run_stage_navigation_verification.cjs'];
function run(name,args){const began=Date.now();console.log('Starting '+name);const r=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout:600000,maxBuffer:4*1024*1024});const file=path.join(out,name+'.log');fs.writeFileSync(file,(r.stdout||'')+(r.stderr||'')+(r.error?'\n'+r.error.stack:''));report.checks.push({name,args,exitCode:r.status,milliseconds:Date.now()-began,log:path.relative(root,file)});console.log(name+' exit '+r.status);if(r.status!==0)throw Error(name+' failed; see '+file);}
try{
 run('syntax',['scripts/check-source.js']);run('verifier-syntax',['--check','設計検証/check_stage_navigation.cjs']);run('unit',['scripts/run-tests.js']);run('build',['scripts/build.js']);
 for(const [name,option,value] of [['chromium','--engine','chromium'],['webkit','--engine','webkit'],['chrome','--channel','chrome'],['msedge','--channel','msedge']]){
  for(const [label,file,extra] of [['navigation','設計検証/check_stage_navigation.cjs',[]],['offline','設計検証/check_stage_navigation.cjs',['--offline']],['header','設計検証/check_mobile_header.cjs',[]]])run(name+'-'+label,[file,'--playwright-path',pw,option,value,...extra]);
  const header=path.join(out,'header',name);fs.mkdirSync(header,{recursive:true});for(const f of ['report.json','portrait.png'])fs.copyFileSync(path.join(__dirname,'スマホヘッダ',name,f),path.join(header,f));
 }
 report.sourceSha256=Object.fromEntries(sources.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));report.passed=true;
}catch(error){report.error=error.stack;console.error(error.stack);process.exitCode=1;}
finally{report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));}
