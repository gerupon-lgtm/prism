const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const commit=process.argv[2];if(!/^[a-f0-9]{40}$/.test(commit||''))throw Error('Pass the source commit');
const version=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../package.json'))).version,out=path.join(__dirname,'下側の常設欄',version),pw='C:/Users/user/Documents/あとキュー/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core';
const report={version,commit,checks:[],passed:false};
for(const [name,url]of[['cloudflare','https://prism.sikumilab.com/'],['github','https://gerupon-lgtm.github.io/prism/']])for(const [kind,file,extra]of[['public','check_public.cjs',['--commit',commit,'--out-dir',path.join(out,new URL(url).hostname,'public')]],['lower','check_lower_status_magnifier.cjs',['--engine','chromium']]]){
 const label=name+'-'+kind;console.log('Starting '+label);const log=path.join(out,label+'.log'),fd=fs.openSync(log,'w'),started=Date.now(),r=spawnSync(process.execPath,[path.join(__dirname,file),'--playwright-path',pw,'--url',url,...extra],{stdio:['ignore',fd,fd],timeout:240000});fs.closeSync(fd);
 const text=fs.readFileSync(log,'utf8'),row={name:label,exit:r.status,elapsedMs:Date.now()-started,passed:r.status===0,summary:text.trim().split(/\r?\n/).slice(-2).join(' ')};report.checks.push(row);fs.writeFileSync(path.join(out,'public-batch.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(row));if(!row.passed){process.exitCode=1;process.exit();}
}
report.passed=true;fs.writeFileSync(path.join(out,'public-batch.json'),JSON.stringify(report,null,2));
