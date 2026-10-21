const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),version=JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,out=path.join(__dirname,'鏡のテンポ',version,'matrix');fs.mkdirSync(out,{recursive:true});
const suite=process.argv[2]||'ui',jobs=suite==='unit'?[['all-unit','scripts/run-tests.js']]:suite==='final'?[
 ['all-unit','scripts/run-tests.js'],...['chromium','webkit'].map(engine=>['offline-'+engine,'設計検証/check_extension_sets.cjs','--engine',engine,'--offline','--from-stage','31','--stages','31,32,36,42','--playwright-path','C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'])
]:[
 ['chromium-phone','設計検証/check_mirror_tempo_ui.cjs'],['webkit-phone','設計検証/check_mirror_tempo_ui.cjs','--engine','webkit'],['chrome-desktop','設計検証/check_mirror_tempo_ui.cjs','--channel','chrome','--desktop'],['edge-desktop','設計検証/check_mirror_tempo_ui.cjs','--channel','msedge','--desktop']
],report={passed:false,suite,jobs:[]};
for(const[name,file,...args]of jobs){console.log('Starting '+name);const log=path.join(out,name+'.log'),fd=fs.openSync(log,'w'),r=spawnSync(process.execPath,[path.join(root,file),...args],{cwd:root,stdio:['ignore',fd,fd],windowsHide:true,timeout:900000});fs.closeSync(fd);report.jobs.push({name,code:r.status,error:r.error?.message});fs.writeFileSync(path.join(out,suite+'.json'),JSON.stringify(report,null,2));if(r.status!==0){console.error(fs.readFileSync(log,'utf8').slice(-2400));process.exit(1);}console.log('Passed '+name);}
report.passed=true;fs.writeFileSync(path.join(out,suite+'.json'),JSON.stringify(report,null,2));console.log('Passed '+suite);
