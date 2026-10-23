import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {challenges,challengeCircuit} from '../src/content/challenges.js';
import {randomVariants} from '../src/content/random-variants.js';
import {returnVariants} from '../src/content/return-variants.js';
import {mirrorVariants} from '../src/content/mirror-variants.js';
import {gateVariants} from '../src/content/gate-variants.js';
import {legalWirings,inspectProblem} from './random-challenge-validation.js';
import {drawChallenge} from '../src/content/challenge-draw.js';
import {Simulation} from '../src/core/simulation.js';
import {faultCases,worstFault,perfectScore} from '../src/core/evaluation.js';
import {Session} from '../src/app/session.js';
import {LocalRecords} from '../src/core/storage.js';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const old=read('tests/fixtures/pre-brisk-0.88.json');
const proofs={regular:read('設計検証/ランダム課題/generation.json'),return:read('設計検証/星への帰還/proof.json'),mirror:read('設計検証/月鏡の静殿/proof.json'),gate:read('設計検証/星刻の開廊/proof.json')};
const banks={...randomVariants,...returnVariants,...mirrorVariants,...gateVariants};
const max=(rows,f)=>Math.max(...rows.map(f));
const finish=(c,t)=>Number(t)+(c.type==='interval'?(c.count-1)*Number(c.interval):0);
const result={version:read('package.json').version,definitions:42,draws:Object.values(banks).flat().length,stages:[],boundary:'Experiment event time; real display and editing-return durations are separately checked by check_play_pacing.cjs. Subjective challenge is not proven by enumeration.'};
for(const c of challenges){
 const variants=banks[c.id],kind=c.number<=6?'intro':c.number<=24?'regular':c.number<=30?'return':c.number<=36?'mirror':'gate';
 let item={number:c.number,id:c.id,name:c.name,type:c.type,kind,version:c.version,draws:variants?.length??0};
 if(kind==='intro'){
  let combinations=0,maximum=0;const classified={perfect:{count:0,maxDuration:0},partial:{count:0,maxDuration:0},failed:{count:0,maxDuration:0}};let perfectLast=0;
  for(const ids of legalWirings(c)){
   const circuit=challengeCircuit(c,ids),faults=['edge-fault','prism-fault'].includes(c.type)?faultCases(circuit,c.type==='edge-fault'?'edge':'prism',c.goal):[],scenarios=[circuit,...faults.map(f=>f.conditions)];
   const runs=scenarios.map(conditions=>{const run=new Simulation(conditions);let n=0;while(!run.exhausted&&n++<2048)run.advanceNext();assert(run.exhausted);maximum=Math.max(maximum,Number(run.format()));combinations++;return run;});
   const worst=faults.length?worstFault(faults,runs[0].circuit.time):null,run=worst?runs[faults.findIndex(f=>f.id===worst.id)+1]:runs[0];
   const s=new Session(new LocalRecords({getItem:()=>null,setItem:()=>{}}),{random:()=>0});s.run=run;s.cases=faults;s.runContext={mode:'challenge',challenge:c,original:circuit,guide:false};s.evaluate();
   const state=s.result.state==='achieved'?(perfectScore(s.result.score)?'perfect':'partial'):'failed';classified[state].count++;classified[state].maxDuration=Math.max(classified[state].maxDuration,Number(run.format()));if(state==='perfect')perfectLast=Math.max(perfectLast,finish(c,s.result.evaluatedTime));
  }
  Object.assign(item,{maximumRun:maximum,perfectLast,execution:classified,proofCombinations:combinations,classificationUnit:'allowed wiring; fault stages evaluate the worst single fault; maximumRun also exhausts intact and every fault scenario',unchanged:true});
 }else{
  const rows=variants.map(v=>{const r=proofs[kind].stages.find(x=>x.id===v.id);assert(r?.valid&&r.winners===1,c.id+' proof');return r;});
  if(kind==='mirror'){
   for(let i=0;i<variants.length;i++){
    const d=drawChallenge(c,{random:()=>i/8}),r=inspectProblem(d),p=rows[i];assert(r.valid);assert.equal(r.baseline,p.baseline);assert.equal(r.maxDuration,p.maxDuration);assert.deepEqual(r.winner,p.winner);p.pacing=r.pacing;p.legalWirings=legalWirings(d).length;
   }
  }
  Object.assign(item,{minimumEvaluatedPerfect:kind==='return'?null:Math.min(...rows.map(r=>Number(r.baseline))),perfectLast:max(rows,r=>finish(c,r.baseline)),maximumRun:max(rows,r=>Number(r.maximum??r.maxDuration)),maximumClearRun:max(rows,r=>Number(r.clearMaximum??r.execution?.partial.maxDuration??r.pacing?.maxClearRun)),maximumFailedRun:max(rows,r=>Number(r.failedMaximum??r.execution?.failed.maxDuration??r.pacing?.maxFailedRun)),proofCombinations:rows.reduce((n,r)=>n+Number(r.combinations??r.legalWirings),0),winnerExample:rows[0].winner,partialExample:rows[0].partial});
  if(kind==='gate')item.minimumPerfectWindow=Math.min(...rows.map(r=>r.perfectWindowSeconds));
  if(kind==='return')item.maximumClearFirst=max(rows,r=>r.clearFirstMaximum);
  const prior=old.definitions.find(x=>x.id===c.id),priorRows=old.proof[kind].stages.filter(r=>r.challenge===c.id);
  item.previousPerfectLast=max(priorRows,r=>finish(prior,r.baseline));item.previousMaximumRun=max(priorRows,r=>Number(r.maximum??r.maxDuration));
  assert(item.perfectLast<=8.5+1e-8,c.id+' perfect finish');assert(item.maximumRun<=12,c.id+' all run ceiling');assert(item.maximumRun<=item.previousMaximumRun+1e-8,c.id+' no slower full run');
 }
 result.stages.push(item);console.log(c.number,c.id,item.perfectLast,item.maximumRun);
}
assert.equal(result.draws,288);const out='設計検証/再生テンポ-20261023';mkdirSync(out,{recursive:true});writeFileSync(out+'/all-stage-pacing.json',JSON.stringify(result,null,2)+'\n');
console.log('ALL 42 STAGES AUDITED');
