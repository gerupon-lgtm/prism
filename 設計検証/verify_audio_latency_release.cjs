const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),version=JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,out=path.join(__dirname,'音声の遅延設定',version);fs.mkdirSync(out,{recursive:true});
const pw='C:/Users/user/Documents/あとキュー/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core',tasks=[];
for(const [name,file]of [['unit','run-tests.js'],['syntax','check-source.js'],['build','build.js']])tasks.push({name,args:[path.join(root,'scripts',file)]});
for(const [browser,args]of [['chromium',['--engine','chromium']],['webkit',['--engine','webkit']],['chrome',['--channel','chrome']],['msedge',['--channel','msedge']]]){
 tasks.push({name:'latency-'+browser,args:[path.join(__dirname,'check_audio_latency.cjs'),'--playwright-path',pw,...args]});
 tasks.push({name:'sounds-'+browser,args:[path.join(__dirname,'check_outcome_audio.cjs'),'--playwright-path',pw,...args,'--out-dir',path.join(out,'sounds',browser)]});
}
tasks.push({name:'wiring',args:[path.join(__dirname,'check_wiring_help.cjs'),'--playwright-path',pw,'--out-dir',path.join(out,'wiring-regression')]});
const from=process.argv.indexOf('--from'),start=from<0?0:tasks.findIndex(t=>t.name===process.argv[from+1]);if(start<0)throw Error('Unknown task');
const file=path.join(out,'local-batch.json'),old=from<0?null:JSON.parse(fs.readFileSync(file)),report={version,passed:false,checks:old?old.checks.filter(r=>tasks.findIndex(t=>t.name===r.name)<start):[]};
for(const task of tasks.slice(start)){console.log('Starting '+task.name);const began=Date.now(),log=path.join(out,task.name+'.log'),fd=fs.openSync(log,'w'),r=spawnSync(process.execPath,task.args,{cwd:root,stdio:['ignore',fd,fd],timeout:300000});fs.closeSync(fd);const output=fs.readFileSync(log,'utf8'),row={name:task.name,exit:r.status,elapsedMs:Date.now()-began,passed:r.status===0,summary:output.trim().split(/\r?\n/).slice(-2).join(' ')};if(task.name==='unit'){row.tests=[...output.matchAll(/tests (\d+)/g)].reduce((n,m)=>n+Number(m[1]),0);row.files=Number(/All (\d+) test files passed/.exec(output)?.[1]);}report.checks.push(row);fs.writeFileSync(file,JSON.stringify(report,null,2));console.log(JSON.stringify(row));if(!row.passed){process.exitCode=1;break;}}
report.passed=report.checks.length===tasks.length&&report.checks.every(r=>r.passed);fs.writeFileSync(file,JSON.stringify(report,null,2));
