const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const commit=process.argv[2];if(!/^[a-f0-9]{40}$/.test(commit||''))throw Error('Pass the source commit');
const version=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../package.json'))).version,out=path.join(__dirname,'音声の遅延設定',version),pw='C:/Users/user/Documents/あとキュー/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core';
const report={version,commit,checks:[],passed:false};
for(const [site,url]of [['cloudflare','https://prism.sikumilab.com/'],['github','https://gerupon-lgtm.github.io/prism/']])for(const [kind,file,extra]of [['public','check_public.cjs',['--commit',commit,'--out-dir',path.join(out,new URL(url).hostname,'public')]],['latency','check_audio_latency.cjs',['--engine','chromium']]]){
 const name=site+'-'+kind;console.log('Starting '+name);const log=path.join(out,name+'.log'),fd=fs.openSync(log,'w'),began=Date.now(),r=spawnSync(process.execPath,[path.join(__dirname,file),'--playwright-path',pw,'--url',url,...extra],{stdio:['ignore',fd,fd],timeout:300000});fs.closeSync(fd);const output=fs.readFileSync(log,'utf8'),row={name,exit:r.status,elapsedMs:Date.now()-began,passed:r.status===0,summary:output.trim().split(/\r?\n/).slice(-2).join(' ')};report.checks.push(row);fs.writeFileSync(path.join(out,'public-batch.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(row));if(!row.passed){process.exitCode=1;process.exit();}
}
report.passed=true;fs.writeFileSync(path.join(out,'public-batch.json'),JSON.stringify(report,null,2));
