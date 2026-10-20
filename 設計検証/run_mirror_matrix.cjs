// Bound memory use: all UI jobs and tests run serially.
const {spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),version=JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,out=path.join(__dirname,'鏡の回転',version,'matrix');fs.mkdirSync(out,{recursive:true});
const pw='C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',suite=process.argv[2]||'mirrors';
const jobs=suite==='mirrors'?[
 ['optics-chromium','設計検証/check_mirror_optics.cjs'],['optics-webkit','設計検証/check_mirror_optics.cjs','--engine','webkit'],['optics-chrome','設計検証/check_mirror_optics.cjs','--channel','chrome'],['optics-msedge','設計検証/check_mirror_optics.cjs','--channel','msedge'],
]:suite==='unit'?[[ 'all-unit','scripts/run-tests.js' ]]:suite==='offline'?[[ 'offline','設計検証/run_extension_matrix.cjs','offline' ]]:[[ 'regressions','設計検証/run_extension_matrix.cjs','regression' ]];
const report={passed:false,suite,jobs:[]};
for(const [name,file,...args]of jobs){
 console.log('Starting '+name);const log=path.join(out,name+'.log'),fd=fs.openSync(log,'w');
 const r=spawnSync(process.execPath,[path.join(root,file),...args,...(file.endsWith('check_mirror_optics.cjs')?['--playwright-path',pw]:[])],{cwd:root,stdio:['ignore',fd,fd],windowsHide:true,timeout:900000});fs.closeSync(fd);
 report.jobs.push({name,code:r.status,error:r.error?.message});fs.writeFileSync(path.join(out,suite+'.json'),JSON.stringify(report,null,2));if(r.status!==0){console.error(fs.readFileSync(log,'utf8').slice(-2800));process.exit(1);}console.log('Passed '+name);
}
report.passed=true;fs.writeFileSync(path.join(out,suite+'.json'),JSON.stringify(report,null,2));console.log('Passed '+suite);
