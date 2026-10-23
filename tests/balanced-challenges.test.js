import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {challenges,challengeLabel} from '../src/content/challenges.js';
import {drawChallenge} from '../src/content/challenge-draw.js';
import {randomVariants} from '../src/content/random-variants.js';
import {returnVariants} from '../src/content/return-variants.js';
import {mirrorVariants} from '../src/content/mirror-variants.js';
import {gateVariants} from '../src/content/gate-variants.js';
import {matchesChallengeScore} from '../src/core/challenge-identity.js';
import {bellSequenceResult} from '../src/core/bell-sequence.js';
import {simulateWiring} from '../scripts/random-challenge-validation.js';
import {compileBalancedGraph,runBalancedClock} from '../scripts/generate-balanced-challenges.js';

const proof=JSON.parse(readFileSync(new URL('../設計検証/ランダム課題/generation.json',import.meta.url),'utf8'));
const baseline=JSON.parse(readFileSync(new URL('./fixtures/pre-balanced-0.87.json',import.meta.url),'utf8'));
const revised=challenges.filter(c=>c.balanceRevision===true);
const expected=['Q8','Q9','Q10','Q11','Q12','Q20','Q21','Q22','Q25','Q26','Q27','Q28'].sort();
const effective=(c,node)=>({...node,...c.displayPositions?.[node.id]});
const edgeKey=(a,b)=>[a,b].sort().join(':');

test('左右の配置見直し後も42面と内部IDを保ち、実践36面に各8出題を持つ',()=>{
 assert.equal(challenges.length,42);assert.equal(new Set(challenges.map(c=>c.id)).size,42);
 assert.deepEqual(challenges.map(challengeLabel),Array.from({length:42},(_,i)=>'Q'+(i+1)));
 assert.deepEqual(revised.map(c=>c.id).sort(),expected);
 const banks={...randomVariants,...returnVariants,...mirrorVariants,...gateVariants};let draws=0;
 for(const c of challenges.slice(6)){
  assert.equal(banks[c.id]?.length,8,c.id);draws+=banks[c.id].length;
  for(const variant of banks[c.id]){
   assert.equal(variant.baseVersion,c.version,c.id);assert.equal(variant.times.length,c.candidates.length,c.id);
  }
 }
 assert.equal(draws,288);
});

test('改訂面の表示点と道の骨格は中心線で左右対応し、星と鐘の役割を保つ',()=>{
 for(const c of revised){
  const points=c.nodes.map(n=>effective(c,n)),mirror=new Map();
  for(const node of points){
   const counterpart=points.find(other=>other.kind===node.kind&&Math.abs(other.x-(1-node.x))<1e-9&&Math.abs(other.y-node.y)<1e-9);
   assert(counterpart,c.id+' symmetric '+node.id);mirror.set(node.id,counterpart.id);
   if(node.kind==='source'||node.kind==='goal'){
    const original=c.nodes.find(n=>n.id===node.id);assert.equal(node.x,original.x,c.id+' '+node.id);assert.equal(node.y,original.y,c.id+' '+node.id);
   }
  }
  const skeleton=new Set(c.candidates.map(e=>edgeKey(e.from,e.to)));
  for(const e of c.candidates)assert(skeleton.has(edgeKey(mirror.get(e.from),mirror.get(e.to))),c.id+' reflected route '+e.id);
  assert.equal(c.candidates.filter(e=>e.from==='S').length,1,c.id+' one common start');
 }
});

test('改訂した実践出題は一意満点・部分点・目的保持と異なる満点配線2系統の証拠を持つ',()=>{
 for(const c of revised){
  const bank=randomVariants[c.id],families=new Map();
  const oldMaximum=Math.max(...baseline.banks[c.id].map(v=>Number(v.maxDuration)));
  for(const variant of bank){
   const row=proof.stages.find(r=>r.id===variant.id&&r.challenge===c.id);assert(row,c.id+' '+variant.id);
   assert.equal(row.valid,true);assert.equal(row.winners,1);assert.equal(row.purposeFailures,0);
   if(['Q8','Q9','Q10','Q11','Q12'].includes(c.id))assert(row.traps.length,c.id+' locally tempting losing choice');
   assert.equal(row.baseline,variant.baseline);assert.equal(row.maxDuration,variant.maxDuration);assert(row.partial?.edges.length);
   assert(Number(variant.maxDuration)<=oldMaximum,c.id+' retains the previous maximum run duration');
   const winner=[...row.winner].sort().join(',');
   if(families.has(variant.family))assert.equal(families.get(variant.family),winner,c.id+' stable family');else families.set(variant.family,winner);
  }
  assert.deepEqual([...families.keys()].sort(),[0,1],c.id);assert.notEqual(families.get(0),families.get(1),c.id);
  const old={challenge:c.id+'@'+(c.version-1)+'/random-1-old',rule:c.type+'@1'};
  assert.equal(matchesChallengeScore(old,drawChallenge(c,{random:()=>0})),false,c.id+' previous results remain separate');
 }
});

test('各改訂面の2系統を実計算で照合し、軽い探索時計も待ち時間を含めて一致する',()=>{
 for(const authored of revised){
  const compiled=compileBalancedGraph(authored);
  for(const family of [0,1]){
   const variant=randomVariants[authored.id].find(v=>v.family===family),row=proof.stages.find(r=>r.id===variant.id);
   const c={...authored,candidates:authored.candidates.map((e,i)=>({...e,time:variant.times[i]}))};
   for(const ids of [row.winner,row.partial.edges]){
    const run=simulateWiring(c,ids),actual=run.arrivals(),wiring=compiled.wirings.find(w=>w.ids.length===ids.length&&w.ids.every(id=>ids.includes(id)));
    assert(wiring,authored.id+' verified legal wiring');
    const quick=runBalancedClock(compiled,variant.times.map(t=>Math.round(Number(t)*100)),wiring);
    for(const goal of compiled.goals){
     const id=authored.nodes[goal].id;
     assert.deepEqual(quick.arrivals[goal].map(t=>String(t/100)),actual.filter(r=>r.node===id).map(r=>r.time),c.id+' clock '+id);
    }
    assert.equal(String(quick.end/100),run.format(),c.id+' completion clock');
    assert.equal(quick.waiting,run.records.some(r=>r.type==='process-start'&&Number(r.wait)>0),c.id+' queue waiting');
    if(c.id==='Q22')assert(new Set(run.records.filter(r=>r.type==='branch'&&c.nodes.some(n=>n.id===r.node&&n.kind==='prism')).map(r=>r.node)).size>=2,'Q22 needs successive branching');
    let time;
    if(c.type==='interval'){
     const result=run.intervalResult(c.goal,c.interval,c.count);assert.equal(result.state,'achieved');time=result.first;
    }else if(c.type==='bell-sequence'){
     const result=bellSequenceResult(c,run);assert.equal(result.state,'achieved');time=result.actual;
    }else time=String(Math.max(...c.goals.map(id=>Number(run.arrivals(id)[0]?.time))));
    assert.equal(time,ids===row.winner?row.baseline:row.partial.time,c.id+' saved proof');
   }
  }
 }
});
