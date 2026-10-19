const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'鐘の順番','0.67.0'),commit=process.argv[2];if(!/^[a-f0-9]{40}$/.test(commit||''))throw Error('Pass source commit');
const pw='C:/Users/user/Documents/あとキュー/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core',report=JSON.parse(fs.readFileSync(path.join(out,'verification.json')));
report.publicVerified=false;report.sourceCommit=commit;report.publicChecks=[];
try{
 for(const url of ['https://prism.sikumilab.com/','https://gerupon-lgtm.github.io/prism/']){
  const host=new URL(url).hostname;
  for(const [label,file,extra]of [['release','設計検証/check_public.cjs',['--commit',commit,'--out-dir',path.join(out,'public',host)]],['sequence','設計検証/check_sequence_set.cjs',[]]]){
   console.log(host+' '+label);const began=Date.now(),r=spawnSync(process.execPath,[file,'--url',url,'--playwright-path',pw,...extra],{cwd:root,encoding:'utf8',timeout:600000,maxBuffer:4*1024*1024}),log=path.join(out,host+'-'+label+'.log');fs.writeFileSync(log,(r.stdout||'')+(r.stderr||'')+(r.error?'\n'+r.error.stack:''));report.publicChecks.push({url,label,exitCode:r.status,milliseconds:Date.now()-began,log:path.relative(root,log)});if(r.status!==0)throw Error(host+' '+label+' failed');console.log('passed');
  }
 }
 report.publicVerified=true;
}catch(error){report.publicError=error.stack;console.error(error.stack);process.exitCode=1;}
finally{report.publicCheckedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));}
