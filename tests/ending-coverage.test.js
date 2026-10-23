import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {Session} from '../src/app/session.js';
import {LocalRecords} from '../src/core/storage.js';
import {challenges,challengeCircuit} from '../src/content/challenges.js';
import {drawChallenge} from '../src/content/challenge-draw.js';
import {EndWait,END_WAIT_MS,CLEAR_END_WAIT_MS} from '../src/ui/end-wait.js';

// Session clock coverage, not browser animation or physical-device evidence.
// Both solution families (draws 1 and 5) cover all 42 displayed stages. The
// explicitly shortened safety bounds below are fixtures, never shipped edits.
const intro=createRequire(import.meta.url)('../設計検証/challenge_fixtures.cjs');
const proofFiles=['ランダム課題/generation.json','星への帰還/proof.json','月鏡の静殿/proof.json','星刻の開廊/proof.json'];
const proofRows=proofFiles.flatMap(file=>JSON.parse(readFileSync(new URL('../設計検証/'+file,import.meta.url),'utf8')).stages);
const drawNumbers=[1,5];

function fixture(number,drawNumber=1,{kind='winner',unreachable=false,cutoff=false}={}){
  const authored=challenges.find(c=>c.number===number);
  assert(authored,'displayed stage '+number);
  const challenge=drawChallenge(authored,{random:()=>(drawNumber-1)/8});
  const row=challenge.draw?proofRows.find(p=>p.challenge===challenge.id&&p.id===challenge.draw.id):null;
  if(challenge.draw){assert(row,challenge.draw.id+' proof row');assert.equal(challenge.draw.number,drawNumber);}
  let edges=challenge.draw?row.winner:intro[challenge.id];
  let phase=row?.optimalPhase??'0',expectedTime=challenge.baseline;
  if(kind==='partial'){
    if(challenge.draw){assert(row.partial,challenge.draw.id+' partial');edges=row.partial.edges;phase=row.partial.phase??'0';expectedTime=row.partial.time;}
    else{assert.equal(number,2);edges=['SC','CG'];expectedTime=null;}
  }else if(kind==='failed'){
    assert.equal(challenge.type,'return-pattern');assert(row.failedExample);edges=row.failedExample.edges;expectedTime=null;
  }
  if(unreachable){
    const source=challenge.nodes.find(n=>n.kind==='source');
    const edge=challenge.candidates.find(e=>e.from===source.id&&['prism','mirror'].includes(challenge.nodes.find(n=>n.id===e.to)?.kind));
    assert(edge,'non-goal first wire '+number);edges=[edge.id];expectedTime=null;phase='0';
  }
  if(cutoff)challenge.maxDuration='0.1';
  const values=new Map();
  const records=new LocalRecords({getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)});
  const session=new Session(records);
  session.challenge=challenge;session.circuit=challengeCircuit(challenge,edges);
  return {session,records,phase,expectedTime,challenge,row};
}

function runUntilEnd(f,{stepped=false}={}){
  const s=f.session,wait=new EndWait();s.start({phaseOffset:f.phase});
  let wall=1000,steps=0;
  if(stepped)s.pause();
  while(!s.run.exhausted){
    assert(++steps<2000,'bounded fixture playback');
    assert.equal(s.editable,false,'active run cannot edit');
    assert.equal(wait.ready(s.run,wall,{allowNoArrival:true,cleared:Boolean(s.clearChoices)}),false,'no waiting deadline while light is active');
    if(stepped)s.next();
    else{
      const scale=s.run.circuit.time;
      s.advance(scale.format(s.run.clock+scale.ticks('0.1')));
    }
    wall+=100;
  }
  assert.equal(s.run.status,'paused');assert.equal(s.editable,false);
  assert(s.run.clock<=s.run.circuit.time.ticks(f.challenge.maxDuration),'experiment ends within its actual bound');
  assert(s.run.records.every(r=>s.run.circuit.time.ticks(r.time)<=s.run.clock),'records do not extend past the experiment clock');
  return {wait,wall,steps};
}

function assertWaitAndPreserve(f,playback,{cleared=false}={}){
  const s=f.session,{wait,wall}=playback,duration=cleared?CLEAR_END_WAIT_MS:END_WAIT_MS;
  const before=s.exportResult(),circuit=structuredClone(s.circuit),scores=f.records.scores();
  assert.equal(wait.ready(s.run,wall,{allowNoArrival:true,cleared}),false,'ending begins without editing');
  assert.equal(wait.ready(s.run,wall+duration-1,{allowNoArrival:true,cleared}),false,'one millisecond before ending wait');
  assert.equal(s.editable,false);
  assert.equal(wait.ready(s.run,wall+duration,{allowNoArrival:true,cleared}),true,'editing may resume only at the deadline');
  assert.deepEqual(s.exportResult(),before,'presentation wait cannot advance time or alter the result');
  s.stop();assert.equal(s.editable,true);assert.equal(s.run.status,'stopped');
  assert.deepEqual(s.exportResult(),{...before,status:'stopped'},'stopping after the wait preserves all exported experiment data');
  assert.deepEqual(s.circuit,circuit);assert.deepEqual(f.records.scores(),scores);
  assert.equal(wait.ready(s.run,wall+duration+1,{allowNoArrival:true,cleared}),false,'stopped run cannot release a second ending');
}

for(const c of challenges)for(const drawNumber of drawNumbers){
  test(`全42面・満点 Q${c.number} ${c.name} / ${c.type} / 出題${drawNumber}: 全粒終了→1.7秒→結果を保持して編集`,()=>{
    const f=fixture(c.number,drawNumber),playback=runUntilEnd(f),s=f.session;
    assert.equal(s.result.state,'achieved');assert(s.clearChoices);assert.equal(s.result.timeLimitReached,undefined);
    assert.equal(BigInt(s.result.score.numerator),100n*BigInt(s.result.score.denominator));
    assert.equal(s.result.evaluatedTime,f.expectedTime,'exact experiment outcome matches the verified winner');
    assertWaitAndPreserve(f,playback,{cleared:true});
  });
}

for(const number of [2,9,17,22,25,29,31,42])for(const drawNumber of drawNumbers){
  test(`部分点 Q${number} / 出題${drawNumber}: 成立した条件と時計を保ち1.7秒待つ`,()=>{
    const f=fixture(number,drawNumber,{kind:'partial'}),playback=runUntilEnd(f),s=f.session;
    assert.equal(s.result.state,'achieved');assert.equal(s.result.timeLimitReached,undefined);
    assert(BigInt(s.result.score.numerator)<100n*BigInt(s.result.score.denominator));
    assert(BigInt(s.result.score.numerator)>=50n*BigInt(s.result.score.denominator));
    if(f.expectedTime!==null)assert.equal(s.result.evaluatedTime,f.expectedTime);
    assertWaitAndPreserve(f,playback,{cleared:true});
  });
}

for(const number of [25,26,27,28,29,30])for(const drawNumber of drawNumbers){
  test(`帰還の不成立 Q${number} / 出題${drawNumber}: 確定不一致で完了してから2秒待つ`,()=>{
    const f=fixture(number,drawNumber,{kind:'failed'}),playback=runUntilEnd(f),s=f.session;
    assert.equal(s.result.state,'failed');assert.equal(s.result.timeLimitReached,undefined);
    assert.equal(s.run.format(),f.row.failedExample.time,'the verified failed example ends at the same exact tick');
    assert.equal(s.result.score.numerator,'0');assert.equal(f.records.scores().length,0);
    assertWaitAndPreserve(f,playback);
  });
}

for(const c of challenges){
  test(`到達不能 Q${c.number} ${c.name}: 光なしの終了も2秒待ち、未達成を保持`,()=>{
    const f=fixture(c.number,1,{unreachable:true}),playback=runUntilEnd(f),s=f.session;
    assert.equal(s.result.state,'failed');assert.equal(s.result.timeLimitReached,undefined);
    assert.equal(s.run.arrivals().length,0);assert.equal(f.records.scores().length,0);
    assertWaitAndPreserve(f,playback);
  });
}

// Every scoring type, plus mirror/gate processing, uses the same safety-bound
// seam. The 0.1-second fixture is before any required bell, so a bound must stay
// unscored rather than become a failure merely because future events disappear.
for(const number of [1,3,4,5,6,7,19,25,31,42])for(const stepped of [false,true]){
  test(`合成の安全上限 Q${number} / ${stepped?'次の動き':'連続再生'}: 未確定を無得点のまま2秒待つ`,()=>{
    const f=fixture(number,1,{cutoff:true}),scores=f.records.scores(),playback=runUntilEnd(f,{stepped}),s=f.session;
    assert.equal(s.run.format(),'0.1');assert.equal(s.result.timeLimitReached,true);
    assert.equal(s.result.state,'stopped');assert.equal(s.result.score,null);assert.match(s.result.reason,/上限/);
    assert.equal(s.run.arrivals().length,0);assert.deepEqual(f.records.scores(),scores);
    const result=structuredClone(s.result);s.evaluate();assert.deepEqual(s.result,result,'evaluation after completing the picture cannot recalculate a failure');
    assertWaitAndPreserve(f,playback);
    s.evaluate();assert.deepEqual(s.result,result,'explicit stop keeps the same unscored cutoff');
  });
}

for(const state of ['achieved','failed']){
  test(`合成の安全上限・${state}確定済み: 残粒だけを止め、確定得点と全記録を2秒待機後も保持`,()=>{
    // This deliberately synthetic spread circuit rings G1 at 0.5 seconds and
    // keeps a separate light moving until 2 seconds. An unreachable G2 makes
    // the failed case definite; neither case depends on a shipped problem.
    const challenge={id:'synthetic-ending-'+state,version:1,name:'確定後の残粒上限',type:'delivery-all',goals:state==='achieved'?['G1']:['G1','G2'],baseline:'0.5',maxDuration:'1',limit:3};
    const values=new Map(),records=new LocalRecords({getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)});
    const session=new Session(records),f={session,records,challenge};
    session.challenge=challenge;
    session.circuit={mode:'spread',target:'all',nodes:[
      {id:'S',kind:'source',process:'0.5'},{id:'A',kind:'prism',process:'0'},
      {id:'G1',kind:'goal',process:'0'},{id:'G2',kind:'goal',process:'0'},
    ],edges:[{id:'SG1',from:'S',to:'G1',time:'0.5'},{id:'SA',from:'S',to:'A',time:'2'},{id:'AG1',from:'A',to:'G1',time:'0.5'}]};
    session.start();session.advance('0.5');
    assert.equal(session.result.state,state);assert.equal(session.run.exhausted,false);assert.equal(session.run.activeCount,1);
    const decided=structuredClone(session.result),prefix=structuredClone(session.run.records),savedScores=records.scores();
    assert.equal(decided.score.numerator,state==='achieved'?'100':'0');assert.equal(decided.score.denominator,'1');
    assert.equal(savedScores.length,state==='achieved'?1:0);
    session.advance('1');
    assert.equal(session.run.format(),'1');assert.equal(session.run.exhausted,true);assert.equal(session.run.status,'paused');assert.equal(session.editable,false);
    assert.equal(session.result.timeLimitReached,true);assert.match(session.result.reason,/上限/);
    assert.deepEqual(session.result,{...decided,timeLimitReached:true,reason:session.result.reason},'cutoff cannot replace a decided outcome or its score');
    assert.deepEqual(session.run.records,prefix,'ending the remaining light must not manufacture experiment records');
    assert.deepEqual(records.scores(),savedScores,'cutoff neither saves nor removes the already decided score');
    const snapshot=structuredClone(session.result);
    session.result.score.numerator='999';session.result.reason='外部からの変更';session.evaluate();
    assert.deepEqual(session.result,snapshot,'reevaluation restores the independent result snapshot');
    const cleared=Boolean(session.clearChoices)&&!session.result.timeLimitReached;
    assert.equal(cleared,false,'the app uses the 3-second safety ending even after an achieved result');
    assertWaitAndPreserve(f,{wait:new EndWait(),wall:1000},{cleared});
    session.evaluate();assert.deepEqual(session.result,snapshot);assert.deepEqual(records.scores(),savedScores);
  });
}

test('終了網羅の台帳は全42面・8判定種別・帰還6面・両解答系統を含む',()=>{
  assert.equal(challenges.length,42);
  assert.deepEqual(challenges.map(c=>c.number),Array.from({length:42},(_,i)=>i+1));
  assert.deepEqual([...new Set(challenges.map(c=>c.type))].sort(),['bell-sequence','delivery-all','edge-fault','interval','prism-fault','return-pattern','time','time-hops']);
  assert.deepEqual(challenges.filter(c=>c.type==='return-pattern').map(c=>c.number),[25,26,27,28,29,30]);
  assert.deepEqual(drawNumbers,[1,5]);
});
