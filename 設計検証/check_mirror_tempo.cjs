const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),{createHash}=require('node:crypto');
(async()=>{
 const {mirrorVariants}=await import('../src/content/mirror-variants.js'),{gateVariants}=await import('../src/content/gate-variants.js');
 const previous=await import('data:text/javascript;base64,'+Buffer.from(execFileSync('git',['show','f109b62:src/content/mirror-variants.js'],{encoding:'utf8',windowsHide:true})).toString('base64'));
 const summary=(id,bank)=>({id,bestMin:Math.min(...bank.map(v=>Number(v.baseline))),bestMax:Math.max(...bank.map(v=>Number(v.baseline))),slowest:Math.max(...bank.map(v=>Number(v.maxDuration))),longestWire:Math.max(...bank.flatMap(v=>v.times.map(Number)))});
 const rows=Object.entries(mirrorVariants).map(([id,bank])=>({...summary(id,bank),beforeInstant:summary(id,previous.mirrorVariants[id])}));
 const report={version:JSON.parse(fs.readFileSync('package.json')).version,rows,combined:summary('Q46',gateVariants.Q46)};
 const kept=['src/content/challenges.js','src/content/gate-challenges.js','src/content/gate-variants.js','src/content/return-challenges.js','src/content/return-variants.js','src/content/random-variants.js','src/content/sequence-challenges.js','src/content/themed-challenges.js','src/core/circuit.js','src/core/simulation.js','src/app/session.js','src/ui/board.js','src/ui/end-wait.js'];
 const hash=text=>createHash('sha256').update(String(text).replace(/\r\n/g,'\n')).digest('hex');
 for(const file of kept)assert.equal(hash(fs.readFileSync(file)),hash(execFileSync('git',['show','463d073:'+file],{encoding:'utf8',windowsHide:true})),file+' stays unchanged');
 const {randomVariants}=await import('../src/content/random-variants.js'),{returnVariants}=await import('../src/content/return-variants.js');
 const unchangedDraws=[randomVariants,returnVariants,gateVariants].reduce((n,bank)=>n+Object.values(bank).reduce((m,rows)=>m+rows.length,0),0);assert.equal(unchangedDraws,240);
 report.preserved={baseline:'463d073',stages:36,draws:unchangedDraws,files:kept};
 console.log(JSON.stringify(report,null,2));
 if(process.argv.includes('--assert'))for(const row of rows){assert(row.bestMax<=5,row.id+' best arrival must be at most 5 seconds; actual '+row.bestMax);assert(row.slowest<=8,row.id+' every legal run must finish within 8 seconds; actual '+row.slowest);assert(row.longestWire<=1.2,row.id+' ordinary wires must be at most 1.2 seconds');}
 if(process.argv.includes('--save')){const out=path.join(__dirname,'鏡のテンポ',report.version);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'timings.json'),JSON.stringify(report,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
