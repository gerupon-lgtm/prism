import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {challenges,challengeCircuit,challengeLabel} from '../src/content/challenges.js';
import {drawChallenge} from '../src/content/challenge-draw.js';
import {randomVariants} from '../src/content/random-variants.js';
import {returnVariants} from '../src/content/return-variants.js';
import {mirrorVariants} from '../src/content/mirror-variants.js';
import {gateVariants} from '../src/content/gate-variants.js';
import {Session} from '../src/app/session.js';
import {LocalRecords} from '../src/core/storage.js';
import {compareScores,perfectScore} from '../src/core/evaluation.js';

const readProof=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const sets=[
  {name:'星への帰還',from:24,to:30,firstId:29,type:'return-pattern',world:'starreturn',bank:returnVariants,proof:readProof('../設計検証/星への帰還/proof.json')},
  {name:'月鏡の静殿',from:30,to:36,firstId:35,type:'delivery-all',world:'moonmirror',bank:mirrorVariants,proof:readProof('../設計検証/月鏡の静殿/proof.json')},
  {name:'星刻の開廊',from:36,to:42,firstId:41,type:'delivery-all',world:'stargate',bank:gateVariants,proof:readProof('../設計検証/星刻の開廊/proof.json')},
];
const oldProof=readProof('../設計検証/ランダム課題/generation.json');
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function fixture(){
  const values=new Map(),records=new LocalRecords({getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)});
  return {s:new Session(records,{random:()=>0}),records};
}
function proofRow(set,id){const row=set.proof.stages.find(item=>item.id===id);assert(row,id+' proof');return row;}
function solve(s,c,row,{edges=row.winner,phase=row.optimalPhase??'0'}={}){
  s.challenge=c;s.circuit=challengeCircuit(c,edges);s.start({phaseOffset:phase});s.advance(c.maxDuration);return s.exportResult();
}
function assertMirrorOutputs(s,c){
  for(const mirror of c.nodes.filter(node=>node.kind==='mirror')){
    const outputs=s.circuit.edges.filter(edge=>edge.from===mirror.id);assert(outputs.length<=1);
    assert.equal(s.circuit.nodes.find(node=>node.id===mirror.id).reflectTo,outputs[0]?.to??mirror.reflectTo??null);
    assert.equal(s.run.records.some(row=>row.node===mirror.id&&row.type==='branch'),false);
  }
  if(c.nodes.some(node=>node.kind==='mirror'))assert(s.run.records.some(row=>row.type==='process-end'&&c.nodes.some(node=>node.id===row.node&&node.kind==='mirror')),c.id+' processed mirror');
}
function assertGateStarts(s,c,offset){
  const scale=s.run.circuit.time;
  for(const node of c.nodes.filter(point=>point.gate)){
    const period=scale.ticks(node.gate.period),open=scale.ticks(node.gate.open),phase=(scale.ticks(node.gate.phase)+scale.ticks(offset))%period;
    assert.equal(scale.ticks(s.run.circuit.nodes.get(node.id).gate.phase),phase,c.id+' captured '+node.id);
    let previousFinish=0n;
    for(const row of s.run.records.filter(entry=>entry.type==='process-start'&&entry.node===node.id)){
      const arrived=scale.ticks(row.arrivedAt),ready=arrived>previousFinish?arrived:previousFinish,position=(ready+phase)%period;
      const expected=ready+(position<open?0n:period-position);
      assert.equal(scale.ticks(row.time),expected,c.id+' '+node.id+' exact opening');
      assert.equal(scale.ticks(row.finishTime)-expected,scale.ticks(node.process),c.id+' full processing');
      assert.equal(scale.ticks(row.wait),expected-arrived);
      previousFinish=scale.ticks(row.finishTime);
    }
  }
}

test('旧24課題の定義と旧144出題を直前公開版の内容のまま保持する',()=>{
  // SHA-256 of the JSON values loaded from git HEAD before the three-set extension.
  assert.equal(hash(challenges.slice(0,24)),'2b06ddabc74aa81d3b09d1b4a10fca8e9d04e3f7bb45c783c2ba6c7db48ebfc4');
  assert.equal(hash(randomVariants),'6ba797916ffec344d4322450174434ce9f909a7632ce7a301a651fd5bce5c70e');
});

test('新18面は表示25〜42、専用背景の6面セット、各8出題と2つの満点配線系統を持つ',()=>{
  const ids=new Set();
  for(const set of sets){
    const authored=challenges.slice(set.from,set.to);assert.equal(authored.length,6);assert.equal(set.proof.stages.length,48);
    assert.deepEqual(authored.map(c=>c.id),Array.from({length:6},(_,index)=>'Q'+(set.firstId+index)));
    assert.deepEqual(authored.map(challengeLabel),Array.from({length:6},(_,index)=>'Q'+(set.from+index+1)));
    assert(authored.every(c=>c.type===set.type&&c.world===set.world));assert.equal(new Set(authored.map(c=>c.set)).size,1);
    for(const c of authored){
      const bank=set.bank[c.id];assert.equal(bank.length,8);assert.deepEqual([...new Set(bank.map(row=>row.family))].sort(),[0,1]);
      const families=new Map();
      for(const variant of bank){
        assert(!ids.has(variant.id));ids.add(variant.id);assert.equal(variant.baseVersion,c.version);assert.equal(variant.times.length,c.candidates.length);
        const row=proofRow(set,variant.id);assert.equal(row.valid,true);assert.equal(row.winners,1);assert.equal(row.baseline,variant.baseline);assert.equal(row.family,variant.family);assert(row.partial?.edges.length);
        const winner=JSON.stringify(row.winner);if(families.has(row.family))assert.equal(families.get(row.family),winner);else families.set(row.family,winner);
        if(set.bank===gateVariants)assert(row.perfectWindowSeconds>=1,c.id+' generous perfect window');
      }
      assert.notEqual(families.get(0),families.get(1),c.id+' different full-score wiring');
    }
  }
  assert.equal(ids.size,144);
});

for(const set of sets)test(`${set.name}の全48出題をSessionで満点・部分点に採点し、元条件と最高点を保存する`,()=>{
  let checked=0;
  for(const authored of challenges.slice(set.from,set.to))for(const [index,variant] of set.bank[authored.id].entries()){
    const {s,records}=fixture();s.replace({challengeId:authored.id});
    const c=drawChallenge(authored,{random:()=>index/8}),row=proofRow(set,variant.id);assert.equal(c.draw.id,variant.id);
    const phase=row.optimalPhase??'0',file=solve(s,c,row);
    assert.equal(s.result.state,'achieved',variant.id);assert(perfectScore(s.result.score),variant.id);assert.equal(s.result.evaluatedTime,variant.baseline);
    assert.deepEqual(file.challenge,c);assert.deepEqual(file.conditions,s.run.circuit.raw);assert.deepEqual(file.originalConditions,s.circuit);assert.equal(file.phaseOffset,phase);
    const saved=structuredClone(records.scores()[0]);assert.equal(saved.problem.draw.id,variant.id);assert.deepEqual(saved.problem.candidates,c.candidates);
    assertMirrorOutputs(s,c);
    if(set.bank===returnVariants){
      const arrivals=s.run.arrivals(c.goal),scale=s.run.circuit.time;assert.equal(arrivals.length,c.count);assert(s.run.exhausted);assert(scale.ticks(s.run.format())<scale.ticks(c.maxDuration));
      assert.equal(arrivals.at(-1).time,s.result.evaluatedTime);assert.equal(s.run.format(),arrivals.at(-1).time);
      for(let i=1;i<arrivals.length;i++)assert.equal(scale.ticks(arrivals[i].time)-scale.ticks(arrivals[i-1].time),scale.ticks(c.interval));
      assert(s.run.records.some(entry=>entry.type==='arrival'&&entry.node==='S'));
      assert(s.run.records.some(entry=>entry.type==='branch'&&entry.node==='S'&&scale.ticks(entry.time)>0n&&scale.ticks(entry.time)<=scale.ticks(arrivals.at(-1).time)));
      assert.deepEqual(file.records.filter(entry=>entry.type==='goal'),arrivals);
    }else{
      assert.equal(s.result.goals.length,c.goals.length);assert.deepEqual(file.evaluation.goals,s.result.goals);
    }
    if(set.bank===gateVariants){assert.equal(saved.problem.capturedStartOffset,phase);assertGateStarts(s,c,phase);}
    s.stop();solve(s,c,row,{edges:row.partial.edges,phase:row.partial.phase??'0'});
    assert.equal(s.result.state,'achieved',variant.id+' partial');assert(!perfectScore(s.result.score));assert(compareScores(s.result.score,{numerator:'50',denominator:'1'})>0);
    assert.equal(s.result.evaluatedTime,row.partial.time);assert(compareScores(saved.score,s.result.score)>0);assert.deepEqual(records.scores()[0],saved);
    if(set.bank===gateVariants)assertGateStarts(s,c,row.partial.phase);
    checked++;
  }
  assert.equal(checked,48);
});

test('新18面の再挑戦・記録・練習の往復・配線クリアは出題を保ち、選び直しで満点配線の系統を変える',()=>{
  const {s,records}=fixture();records.saveScore('Q7@1','delivery-all@1',{numerator:'100',denominator:'1'});const old=structuredClone(records.scores()[0]);
  for(const set of sets)for(const authored of challenges.slice(set.from,set.to)){
    s.stop();s.replace({challengeId:authored.id});const c=structuredClone(s.challenge),row=proofRow(set,c.draw.id),file=solve(s,c,row);
    s.openRecords();assert.deepEqual(s.challenge,c);assert.deepEqual(s.run.records,file.records);s.stop();
    s.beginGuide();s.endGuide('interrupted');assert.deepEqual(s.challenge,c);assert.deepEqual(s.exportResult().records,file.records);
    solve(s,c,row,{phase:file.phaseOffset});assert.deepEqual(s.run.records,file.records);assert.deepEqual(s.challenge,c);s.stop();
    const view=structuredClone(s.view);s.clearConnections();assert.deepEqual(s.challenge,c);assert.equal(s.circuit.edges.length,0);assert.deepEqual(s.view,{...view,showAllTimes:true});
    assert.deepEqual(s.circuit.nodes.map(node=>node.gate??null),c.nodes.map(node=>node.gate??null));
    s.replacement({challengeId:c.id});assert.deepEqual(s.challenge,c);s.replace({challengeId:c.id});
    const next=proofRow(set,s.challenge.draw.id);assert.notEqual(next.family,row.family);assert.notDeepEqual(next.winner,row.winner);
  }
  assert.deepEqual(records.scores().find(row=>row.challenge===old.challenge),old);
});

test('24→25、30→31、36→37へ続き、42面の次は一覧へ戻る',()=>{
  const {s}=fixture();
  for(const [id,next] of [['Q28','Q29'],['Q34','Q35'],['Q40','Q41'],['Q46',null]]){
    s.stop();s.replace({challengeId:id});const c=s.challenge,set=sets.find(item=>item.bank[id]),row=set?proofRow(set,c.draw.id):oldProof.stages.find(item=>item.id===c.draw.id);
    solve(s,c,row);assert.equal(s.result.state,'achieved');assert.equal(s.clearChoices.nextChallengeId,next);assert.equal(s.clearChoices.challengeId,id);
  }
});

test('周期が閉じた到着は消えずに待ち、一時停止では位相を保ち、再開後の全記録も同じになる',()=>{
  const set=sets[2];
  for(const authored of challenges.slice(set.from,set.to)){
    const {s}=fixture();s.replace({challengeId:authored.id});const c=structuredClone(s.challenge),row=proofRow(set,c.draw.id);solve(s,c,row);
    const first=s.run.records.find(entry=>entry.type==='arrival'&&c.nodes.some(node=>node.id===entry.node&&node.gate));assert(first);
    const scale=s.run.circuit.time,node=c.nodes.find(point=>point.id===first.node),period=scale.ticks(node.gate.period),open=scale.ticks(node.gate.open);
    const offset=(open+period-((scale.ticks(first.time)+scale.ticks(node.gate.phase))%period))%period,phase=scale.format(offset);
    s.stop();s.circuit=challengeCircuit(c,row.winner);s.start({phaseOffset:phase});s.advance(first.time);
    const waiting=[...s.run.particles.values()].filter(particle=>particle.node===node.id&&particle.status==='waiting');assert(waiting.length>0,c.id+' retains light');assert(!s.run.exhausted);assert.equal(s.run.activeCount>0,true);
    const before=structuredClone(s.exportResult()),clock=s.run.clock;s.pause();s.advance(c.maxDuration);assert.equal(s.run.clock,clock);assert.deepEqual(s.exportResult().conditions,before.conditions);assert.deepEqual(s.run.records,before.records);
    s.resume();s.advance(c.maxDuration);assert.equal(s.result.state,'achieved');assertGateStarts(s,c,phase);const records=structuredClone(s.run.records);
    s.stop();solve(s,c,row,{phase});assert.deepEqual(s.run.records,records,c.id+' same captured phase');
  }
});
