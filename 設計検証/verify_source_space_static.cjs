const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),version=JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,out=path.join(__dirname,'星の秒数と盤面余白',version);fs.mkdirSync(out,{recursive:true});
const report={version,passed:false,checks:[]};
for(const [name,file]of [['unit','run-tests.js'],['syntax','check-source.js'],['build','build.js']]){
 const started=Date.now(),r=spawnSync(process.execPath,[path.join(root,'scripts',file)],{cwd:root,encoding:'utf8',timeout:240000,maxBuffer:2*1024*1024}),log=path.join(out,name+'.log'),output=(r.stdout||'')+(r.stderr||'');fs.writeFileSync(log,output);
 const row={name,exit:r.status,elapsedMs:Date.now()-started,passed:r.status===0};if(name==='unit'){row.tests=[...output.matchAll(/tests (\d+)/g)].reduce((n,m)=>n+Number(m[1]),0);row.files=Number(/All (\d+) test files passed/.exec(output)?.[1]);}
 if(name==='syntax')row.files=Number(/passed: (\d+) files/.exec(output)?.[1]);report.checks.push(row);fs.writeFileSync(path.join(out,'static.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(row));assert.equal(r.status,0,output.slice(-1000));
}
report.passed=true;fs.writeFileSync(path.join(out,'static.json'),JSON.stringify(report,null,2));
