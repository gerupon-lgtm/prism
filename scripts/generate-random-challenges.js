import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { challenges } from '../src/content/challenges.js';
import { inspectProblem,legalWirings } from './random-challenge-validation.js';

const count=8,seed=0x20261016;
// Separate streams keep unchanged stages byte-identical when Q7 generation changes.
const stageSeeds={Q7:seed,Q8:2555178502,Q9:276024310,Q10:4059462030,Q11:3036402878,Q12:2095768320};
let state=seed;
function random(){state=(state+0x6D2B79F5)>>>0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}
const pick=items=>items[Math.floor(random()*items.length)];
const seconds=ticks=>String(ticks/10);
const study=JSON.parse(readFileSync('設計検証/秒数入替検討/examples-report.json','utf8'));
const shuffled=JSON.parse(readFileSync('設計検証/秒数入替検討/report.json','utf8'));
const banks={},proof={seed,count,method:'Bounded offline generation; exhaustive current simulation for all permitted wirings. No answer is included in app assets.',stages:[]};
for(const authored of challenges.slice(6)){
  state=stageSeeds[authored.id];
  const sets=legalWirings(authored),base=study.stages.find(s=>s.id===authored.id);
  let seedTimes=authored.candidates.map(edge=>edge.id==='CD'&&authored.id==='Q7'?16:Math.round(Number(base.times[base.candidateIds.indexOf(edge.id)])*10));
  const overrides={Q7:{BG1:16,CG2:16,AD:16,AE:16,BE:6},Q8:{CD:6,BE:6,AE:16,BG1:16,CG2:16,AG3:26},Q9:{BD:3},Q11:{BG:3,CG:37,AG:43,BC:36},Q12:{AG:3}}[authored.id]??{};
  seedTimes=seedTimes.map((time,i)=>overrides[authored.candidates[i].id]??time);
  if(authored.id==='Q10')seedTimes[0]=5;
  const alternatives={
    Q7:{BD:16,CE:6,BE:5,CD:5},
    Q8:{BD:6,CD:5,BE:5,CE:6},
    Q9:{SA:5,AB:5,BG:5,BC:4,CG:26,CD:26,DE:5,EG:5,AG:25,AC:5,BD:25,CE:15},
    Q10:{SA:5,AB:5,AC:5,BD:5,BE:15,CD:25,CE:41,DG:5,EG:5,BG:55,CG:3,CF:15,FE:15},
    Q11:{SA:5,AB:5,BD:5,AC:41,CD:5,DG:5,AD:25,BG:3,CG:37,AG:43,BC:5},
    Q12:{AC:41,BC:5,AF:35},
  }[authored.id];
  const families=[seedTimes,...(alternatives?[seedTimes.map((time,i)=>alternatives[authored.candidates[i].id]??time)]:[])];
  const fallbackSeeds=shuffled.stages.find(s=>s.id===authored.id).permutations.filter(p=>p.eligible&&p.times.length===authored.candidates.length).map(p=>p.times.map(t=>Math.round(Number(t)*10)));
  const accepted=[],seen=new Set(),validatedSeeds=new Map();let attempts=0;
  while(accepted.length<count&&attempts<240){
    attempts++;
    const family=Math.floor(accepted.length/(count/families.length)),validatedSeed=validatedSeeds.get(family),seedTimes=families[family];
    const origin=validatedSeed??(attempts<=count*2||family>0?seedTimes:pick([seedTimes,...fallbackSeeds]));
    const potentials=Object.fromEntries(authored.nodes.map(n=>[n.id,n.kind==='prism'?Math.floor(random()*5)-(validatedSeed?2:0):0]));
    if(['Q7','Q8'].includes(authored.id)){potentials.D=4;potentials.E=0;}
    if(authored.id==='Q9')potentials.D=Math.floor(random()*2);
    let values=origin.map((t,i)=>t+potentials[authored.candidates[i].to]-potentials[authored.candidates[i].from]);
    // Some proposals also change relative path totals, rather than only shifting them.
    if(attempts>count*2&&!validatedSeed){for(let i=0;i<1+Math.floor(random()*3);i++){const at=Math.floor(random()*values.length);values[at]+=pick([-10,-5,-2,-1,1,2,5,10]);}}
    values[0]+=Math.floor(random()*6);
    if(values.some(t=>t<1||t>80))continue;
    const key=JSON.stringify(values);if(seen.has(key))continue;seen.add(key);
    const challenge={...authored,candidates:authored.candidates.map((e,i)=>({...e,time:seconds(values[i])}))};
    const result=inspectProblem(challenge,sets);
    if(!result.valid||!result.traps.length)continue;
    if(!['Q7','Q8'].includes(authored.id)&&!validatedSeed)validatedSeeds.set(family,values);
    const identity={challenge:authored.id,version:authored.version,type:authored.type,nodes:authored.nodes,candidates:challenge.candidates,limit:authored.limit,goals:authored.goals,goal:authored.goal,interval:authored.interval,count:authored.count};
    const id=createHash('sha256').update(JSON.stringify(identity)).digest('hex').slice(0,16);
    accepted.push({id,baseVersion:authored.version,...(authored.id==='Q7'?{family}:{}),times:challenge.candidates.map(e=>e.time),baseline:result.baseline,maxDuration:result.maxDuration});
    proof.stages.push({challenge:authored.id,id,family,attempt:attempts,legalWirings:sets.length,...result});
    console.log(`${authored.id} ${accepted.length}/${count} attempt=${attempts} perfect=${result.winners} clears=${result.achieved} traps=${result.traps.join(',')}`);
  }
  if(accepted.length!==count)throw new Error(`${authored.id}: 検査済み問題が足りません (${accepted.length}/${count}, ${attempts} attempts)`);
  if(authored.id==='Q7'){
    const solutions=proof.stages.filter(p=>p.challenge==='Q7'),groups=new Map();
    for(const p of solutions){const winner=JSON.stringify(p.winner);if(groups.has(p.family)&&groups.get(p.family)!==winner)throw new Error('Q7の出題群で満点配線が一致しません。');groups.set(p.family,winner);}
    if(groups.size<2||new Set(groups.values()).size!==groups.size)throw new Error('Q7の満点配線が切り替わりません。');
  }
  banks[authored.id]=accepted;
}
mkdirSync('設計検証/ランダム課題',{recursive:true});
writeFileSync('src/content/random-variants.js','// Generated by npm run generate:challenges. Answers stay in verification artifacts.\nexport const randomVariants = '+JSON.stringify(banks,null,2)+';\n');
writeFileSync('設計検証/ランダム課題/generation.json',JSON.stringify(proof,null,2)+'\n');
console.log(`Generated ${proof.stages.length} exhaustively verified problems.`);
