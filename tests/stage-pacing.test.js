import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {challenges} from '../src/content/challenges.js';
import {randomVariants} from '../src/content/random-variants.js';
import {returnVariants} from '../src/content/return-variants.js';
import {mirrorVariants} from '../src/content/mirror-variants.js';
import {gateVariants} from '../src/content/gate-variants.js';
import {stagePacing,perfectFinish} from '../scripts/stage-pacing-policy.js';
import {matchesChallengeScore} from '../src/core/challenge-identity.js';
import {drawChallenge} from '../src/content/challenge-draw.js';
const old=JSON.parse(readFileSync(new URL('./fixtures/pre-brisk-0.88.json',import.meta.url),'utf8'));
const proof=JSON.parse(readFileSync(new URL('../設計検証/ランダム課題/generation.json',import.meta.url),'utf8'));

test('実践の全ての候補と全配線を短い再生として検査し満点だけに偏らない',()=>{
 for(const c of challenges.slice(6,24)){
  const p=stagePacing(c);
  for(const v of randomVariants[c.id]){
   assert.equal(v.baseVersion,c.version,c.id+' content version');
   assert(Math.max(...v.times.map(Number))<=p.maxLeg,c.id+' long line remains');
   assert(Number(v.maxDuration)<=p.maxRun,c.id+' full run');
   assert(perfectFinish(c,v.baseline)<=p.maxPerfectFinish,c.id+' required final bell');
   const row=proof.stages.find(r=>r.id===v.id);assert(row?.valid,c.id+' proof');
   assert(row.pacing,c.id+' success/failure pacing classifications');assert.equal(row.role,p.role,c.id+' pacing role');assert(row.thinkingEvidence?.branches>=p.minBranches,c.id+' actual branching structure');if(p.requiresWaiting)assert(row.thinkingEvidence.waited,c.id+' real merge queue');
   assert(row.pacing.maxClearRun<=p.maxRun&&row.pacing.maxFailedRun<=p.maxRun,c.id+' all outcomes');
   if(p.minTraps)assert(row.traps.length>=p.minTraps,c.id+' plausible locally short choice');
   if(p.thinking)assert(Number(row.partial.time)-Number(row.baseline)<=p.maxAlternativeGap,c.id+' comparable alternatives');
  }
 }
});
test('6面ごとに導入・組合せ・思考・解放・応用・締めを設計し候補を増やして隠さない',()=>{
 assert.deepEqual(challenges.slice(6,12).map(c=>stagePacing(c).role),['discover','combine','think','release','apply','finale']);
 for(const c of challenges){const before=old.definitions.find(v=>v.id===c.id);const actual=c.candidates.map(({id,from,to})=>({id,from,to})),prior=before.candidates.map(({id,from,to})=>({id,from,to}));if(c.type==='return-pattern'){assert.equal(actual.length,[8,10,8,10,10,12][c.number-25],c.id+' reduced candidate count');assert.deepEqual(actual,prior.filter(e=>actual.some(a=>a.id===e.id)),c.id+' only remove redundant routes');}else assert.deepEqual(actual,prior,c.id+' clear graph stays intact');if(c.number<37&&![29,30].includes(c.number))assert.deepEqual(c.nodes,before.nodes,c.id+' parts stay intact');else assert.deepEqual(c.nodes.map(({process,gate,...rest})=>rest),before.nodes.map(({process,gate,...rest})=>rest),c.id+' visual parts stay intact');assert.deepEqual(c.displayPositions,before.displayPositions,c.id+' silhouette');}
});
test('42面288出題と旧条件・成績の区別を保ち、お試しと鏡のテンポは変えない',()=>{
 assert.equal(challenges.length,42);const bank={...randomVariants,...returnVariants,...mirrorVariants,...gateVariants};
 assert.equal(Object.values(bank).reduce((n,a)=>n+a.length,0),288);
 for(const c of challenges){
  const prior=old.definitions.find(x=>x.id===c.id);
  if(c.number<=6){assert.deepEqual(c,prior);continue;}
  const drawn=drawChallenge(c,{random:()=>0});
  for(const variant of bank[c.id])assert.equal(variant.baseVersion,c.version,c.id);
  if(c.number>=31&&c.number<=36){assert.deepEqual(bank[c.id],old.banks[c.id],c.id+' instant mirrors');continue;}
  assert.equal(c.version,prior.version+1,c.id+' revised content version');
  assert.equal(matchesChallengeScore({challenge:c.id+'@'+prior.version+'/random-1-'+old.banks[c.id][0].id,rule:c.type+'@1'},drawn),false,c.id+' previous score');
  assert.equal(c.limit,prior.limit+(c.number===30?1:0),c.id+' explicit wire budget revision');assert.deepEqual(c.goals,prior.goals);assert.equal(c.count,prior.count);assert.equal(c.interval,prior.interval);assert.deepEqual(c.intervals,prior.intervals);
 }
});
