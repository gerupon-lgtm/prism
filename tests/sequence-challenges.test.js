import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {challenges,challengeCircuit} from '../src/content/challenges.js';
import {randomVariants} from '../src/content/random-variants.js';
import {randomVariants as legacyVariants} from '../設計検証/鐘の順番/0.67.0/legacy-variants.js';
import {Session} from '../src/app/session.js';
import {LocalRecords} from '../src/core/storage.js';
import {perfectScore,compareScores} from '../src/core/evaluation.js';
import {Simulation} from '../src/core/simulation.js';
import {drawChallenge} from '../src/content/challenge-draw.js';
import {matchesChallengeScore} from '../src/core/challenge-identity.js';
const proof=JSON.parse(readFileSync(new URL('../設計検証/ランダム課題/generation.json',import.meta.url)));
function fixture(){const values=new Map(),records=new LocalRecords({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)});return {values,records,s:new Session(records,{random:()=>0})};}

test('間隔指定の4課題だけ内容版2へ上げ、順番のみと既存112出題を保持する',()=>{
 const unchanged=JSON.parse(readFileSync(new URL('../設計検証/厳密な到達間隔/0.69.0/unchanged-draws.json',import.meta.url)));
 for(const [id,bank]of Object.entries(unchanged))assert.deepEqual(randomVariants[id],bank,id);
 for(const c of challenges.slice(18,24)){
  if(c.intervals){assert.equal(c.version,2);assert.equal(c.intervalTolerance,undefined);assert(randomVariants[c.id].every(v=>v.baseVersion===2));}
  else {assert.equal(c.version,1);assert.equal(c.intervals,undefined);}
 }
});

test('旧許容幅の成績と元条件を残し、新条件の最高点と混ぜない',()=>{
 const legacy=JSON.parse(readFileSync(new URL('../設計検証/厳密な到達間隔/0.69.0/legacy-problems.json',import.meta.url)));
 for(const {problem,winner}of legacy){
  const {s,records}=fixture();s.replace({challengeId:problem.id});s.challenge=structuredClone(problem);s.circuit=challengeCircuit(problem,winner);s.start();s.advance(problem.maxDuration);
  assert.equal(s.result.state,'achieved');const old=structuredClone(records.scores()[0]);assert.equal(old.problem.intervalTolerance,'0.1');
  s.stop();s.replace({challengeId:problem.id});assert.equal(s.challenge.version,2);assert.equal(matchesChallengeScore(old,s.challenge),false);
  const row=proof.stages.find(p=>p.id===s.challenge.draw.id);s.circuit=challengeCircuit(s.challenge,row.winner);s.start();s.advance(s.challenge.maxDuration);
  assert.equal(s.result.state,'achieved');assert.equal(records.scores().length,2);assert.deepEqual(records.scores().find(r=>r.challenge===old.challenge),old);
 }
});
test('既存96出題の条件・識別子・基準・上限を一切変えず、新セットを6面追加する',()=>{
 for(const [id,variants]of Object.entries(legacyVariants))assert.deepEqual(randomVariants[id],variants,id);
 assert.deepEqual(challenges.slice(18,24).map(c=>c.number),[19,20,21,22,23,24]);assert.equal(challenges[18].intervals,undefined);assert.equal(challenges[20].intervals,undefined);assert(challenges.slice(18,24).every(c=>c.type==='bell-sequence'));
});
test('新48出題の満点と部分点を本体で採点・保存し、全到達時刻を結果へ保持する',()=>{
 for(const authored of challenges.slice(18,24))for(const variant of randomVariants[authored.id]){
  const f=fixture();f.s.replace({challengeId:authored.id});const c={...structuredClone(authored),candidates:authored.candidates.map((e,i)=>({...e,time:variant.times[i]})),baseline:variant.baseline,maxDuration:variant.maxDuration,draw:{id:variant.id,revision:1,number:randomVariants[authored.id].indexOf(variant)+1}};
  f.s.challenge=c;const row=proof.stages.find(p=>p.id===variant.id);assert(row);
  f.s.circuit=challengeCircuit(c,row.winner);f.s.start();f.s.advance(c.maxDuration);assert.equal(f.s.result.state,'achieved',variant.id);assert(perfectScore(f.s.result.score));assert.equal(f.s.result.evaluatedTime,row.baseline);assert.equal(f.s.result.goals.length,c.goals.length);assert.equal(f.records.scores()[0].problem.draw.id,variant.id);
  const full=f.s.exportResult();assert.deepEqual(full.evaluation.goals,f.s.result.goals);f.s.stop();f.s.circuit=challengeCircuit(c,row.partial.edges);f.s.start();f.s.advance(c.maxDuration);assert.equal(f.s.result.state,'achieved');assert(!perfectScore(f.s.result.score));assert(compareScores(f.records.scores()[0].score,f.s.result.score)>0);
 }
});
test('新しい6面は選び直しで満点配線が変わり、配線クリアでは同じ問題を保つ',()=>{
 for(const c of challenges.slice(18,24)){
  const {s}=fixture();s.replace({challengeId:c.id});const first=structuredClone(s.challenge),a=proof.stages.find(p=>p.id===first.draw.id);s.clearConnections();assert.deepEqual(s.challenge,first);s.replace({challengeId:c.id});const b=proof.stages.find(p=>p.id===s.challenge.draw.id);assert.notDeepEqual(a.winner,b.winner);
 }
});
test('18面クリアから19面へ続き、24面から25面へ進める',()=>{
 const {s}=fixture();for(const [id,next]of [['Q10','Q23'],['Q23','Q24'],['Q28','Q29']]){s.stop();s.replace({challengeId:id});const row=proof.stages.find(p=>p.id===s.challenge.draw.id);s.circuit=challengeCircuit(s.challenge,row.winner);s.start();s.advance(s.challenge.maxDuration);assert.equal(s.clearChoices.nextChallengeId,next);}
});
test('一部の鐘への配線だけでは未達成となり、成績を作らない',()=>{
 const {s,records}=fixture();s.replace({challengeId:'Q23'});s.circuit=challengeCircuit(s.challenge,['SA','AB','BG1']);s.start();s.advance(s.challenge.maxDuration);assert.equal(s.result.state,'failed');assert.match(s.result.reason,/すべて/);assert.equal(records.scores().length,0);
});
test('初出題の各鐘の時刻を独立した足し算の表と照合する',()=>{
 // S first sends at0. SA .5 + A .5 gives A departure1.
 // Q24: B departure4 + BG1 .5 =4.5; C departure2 -> D4.5 + DG2 .5 =5.
 // Q25: B2.5 -> D3.1 -> G1 3.2; C1.6 -> E2.6 -> G2 3.6 / G3 4.1.
 // Q26..28: A1 -> C2 -> B3; D4 (Q27 4.5), E4, then terminal edges.
 const expected={Q23:[['G1','2.5'],['G2','3.5']],Q24:[['G1','4.5'],['G2','5']],Q25:[['G1','3.2'],['G2','3.6'],['G3','4.1']],Q26:[['G1','4.5'],['G2','5.5'],['G3','6.5']],Q27:[['G1','5'],['G2','5.5'],['G3','6.5']],Q28:[['G3','4.5'],['G2','5'],['G1','6']]};
 for(const [id,times]of Object.entries(expected)){const c=drawChallenge(challenges.find(c=>c.id===id),{random:()=>0}),row=proof.stages.find(p=>p.id===c.draw.id),run=new Simulation(challengeCircuit(c,row.winner));while(!run.exhausted)run.advanceNext();assert.deepEqual(c.goals.map(id=>[id,run.arrivals(id)[0].time]),times,id);}
});
