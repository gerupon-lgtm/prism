const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),{createHash}=require('node:crypto');
const baseline='a91d2a2',hash=v=>createHash('sha256').update(String(v).replace(/\r\n/g,'\n')).digest('hex');
const old=file=>execFileSync('git',['show',baseline+':'+file],{encoding:'utf8',maxBuffer:8000000,windowsHide:true});
const moduleFrom=text=>import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'));
(async()=>{
 const {challenges}=await import('../src/content/challenges.js'),{gateChallenges}=await import('../src/content/gate-challenges.js'),{gateVariants}=await import('../src/content/gate-variants.js');
 const previous=await moduleFrom(old('src/content/gate-challenges.js')),previousBank=await moduleFrom(old('src/content/gate-variants.js'));
 assert.deepEqual(gateChallenges.filter(c=>c.id!=='Q46'),previous.gateChallenges.filter(c=>c.id!=='Q46'));
 let kept=0;for(const [id,bank]of Object.entries(gateVariants))if(id!=='Q46'){assert.deepEqual(bank,previousBank.gateVariants[id]);kept+=bank.length;}
 const files=['src/content/challenges.js','src/content/random-variants.js','src/content/return-variants.js','src/content/return-challenges.js','src/content/themed-challenges.js','src/content/sequence-challenges.js'];
 for(const file of files)assert.equal(hash(fs.readFileSync(file)),hash(old(file)),file+' unchanged');
 const {randomVariants}=await import('../src/content/random-variants.js'),{returnVariants}=await import('../src/content/return-variants.js');
 kept+=Object.values(randomVariants).reduce((n,b)=>n+b.length,0)+Object.values(returnVariants).reduce((n,b)=>n+b.length,0);assert.equal(kept,232);
 const proof=JSON.parse(fs.readFileSync('設計検証/星刻の開廊/proof.json')),oldProof=JSON.parse(old('設計検証/星刻の開廊/proof.json'));
 assert.deepEqual(proof.stages.filter(r=>r.challenge!=='Q46'),oldProof.stages.filter(r=>r.challenge!=='Q46'));
 const updated=[...JSON.parse(fs.readFileSync('設計検証/月鏡の静殿/proof.json')).stages,...proof.stages.filter(r=>r.challenge==='Q46')];
 assert.equal(updated.length,56);assert(updated.every(r=>r.valid&&r.winners===1&&r.partial));assert(updated.filter(r=>r.challenge==='Q46').every(r=>r.perfectWindowSeconds>=1));
 const version=JSON.parse(fs.readFileSync('package.json')).version,out=path.join('設計検証/鏡の回転',version,'data');fs.mkdirSync(out,{recursive:true});
 const report={passed:true,baseline,version,stages:challenges.length,unchangedStages:35,unchangedDraws:kept,regeneratedDraws:updated.length,uniquePerfectAndPartial:true,hashes:Object.fromEntries(files.map(f=>[f,hash(fs.readFileSync(f))]))};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
