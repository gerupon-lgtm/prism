import test from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '../src/app/session.js';
import { LocalRecords, STORAGE_KEYS } from '../src/core/storage.js';
import { tutorialChallenge } from '../src/content/tutorial.js';
import { challengeCircuit } from '../src/content/challenges.js';
import { Simulation } from '../src/core/simulation.js';
import { arrivalFrequencies } from '../src/content/bell-pitches.js';

function fixture(){
  const values=new Map();let failing=false;
  const records=new LocalRecords({getItem:key=>values.get(key)??null,setItem:(key,value)=>{if(failing)throw Error('Synthetic save failure');values.set(key,value);}});
  return {session:new Session(records),records,values,fail:()=>{failing=true;},recover:()=>{failing=false;}};
}
function finishRun(s,time){s.start();s.advance(time);s.stop();}
function initial(s,path=['S','A','G']){s.beginGuide();s.connectPath(path);finishRun(s,'4');}
function compare(s,path=['A','B','G']){s.remove(s.guide.wireId,true);s.connectPath(path);finishRun(s,'4');}
function branch(s){s.openRecords();s.nextGuideLesson();for(const path of [['S','A','B','G1'],['B','G2'],['A','C','G3']])s.connectPath(path);}

test('練習専用の直通4秒、中継2.5/3.5秒と、三つの鐘の0.5秒間隔が実計算で成立する',()=>{
  const route=tutorialChallenge('route');
  for(const [edges,time]of [[['SA','AG'],'4'],[['SA','AB','BG'],'2.5'],[['SA','AC','CG'],'3.5']]){
    const run=new Simulation(challengeCircuit(route,edges));run.advanceUntil('4');assert.equal(run.arrivals()[0].time,time);
  }
  const song=tutorialChallenge('branch'),run=new Simulation(challengeCircuit(song,song.candidates.map(e=>e.id)));
  run.advanceUntil('3');assert.deepEqual(run.arrivals().map(e=>[e.node,e.time]),[['G1','2'],['G2','2.5'],['G3','3']]);
  const frequencies=[...arrivalFrequencies(song,run.arrivals(),run.circuit.time).values()];
  assert(frequencies[0]<frequencies[1]&&frequencies[1]<frequencies[2]);assert(Math.abs(frequencies[2]/frequencies[0]-2)<1e-10);
  route.nodes[0].x=99;assert.notEqual(tutorialChallenge('route').nodes[0].x,99,'Each practice owns its conditions');
});

test('最初に鐘を鳴らしてから削除・比較・記録・分岐へ進み、実到達まで完了しない',()=>{
  const f=fixture(),s=f.session,original=s.circuit;s.beginGuide();assert.equal(s.guide.revision,2);assert.equal(s.guide.step,0);
  s.connect('S','A');assert.equal(s.guide.step,0);s.connect('A','G');s.start();s.advance('3.9');assert.equal(s.guide.step,0);
  s.advance('4');assert.equal(s.guide.step,1);assert.equal(s.guide.wireId,'AG');assert.deepEqual(s.guide.firstResult,{time:'4',score:{numerator:'325',denominator:'4'},edges:['AG','SA']});s.stop();
  assert.throws(()=>s.remove('AG'));assert.equal(s.guide.step,1);s.remove('AG',true);assert.equal(s.guide.step,2);
  s.evaluate();s.openRecords();assert.equal(s.guide.step,2);assert.equal(s.guide.comparison,null,'Old first run is not a comparison');
  s.connectPath(['A','B','G']);s.start();s.advance('2.4');assert.equal(s.guide.step,2);s.advance('2.5');assert.equal(s.guide.step,3);
  assert.equal(s.guide.comparison.time,'2.5');assert.deepEqual(s.guide.comparison.score,{numerator:'100',denominator:'1'});assert.equal(s.guide.readyToFinish,false);
  s.openRecords();assert.equal(s.guide.step,4);assert.throws(()=>s.nextGuideLesson(),/停止/);s.stop();s.nextGuideLesson();assert.equal(s.guide.step,5);assert.equal(s.circuit.mode,'spread');assert.equal(s.guide.comparison.time,'2.5');
  for(const path of [['S','A','B','G1'],['B','G2'],['A','C','G3']])s.connectPath(path);
  s.start();s.advance('2.5');assert.equal(s.guide.readyToFinish,false);s.advance('3');assert.equal(s.guide.readyToFinish,true);assert.equal(s.clearChoices,null);
  assert.equal(f.records.scores().length,0);assert.equal(s.pendingScores.size,0);s.endGuide('completed');assert.equal(s.circuit,original);assert.equal(f.records.guideHistory().challenge,'completed');
});

test('別の線の削除・途中停止・早すぎる記録は進行せず、別経路の部分点も比較として認める',()=>{
  const s=fixture().session;s.beginGuide();s.connectPath(['S','A','G']);s.start();s.advance('1');s.openRecords();assert.equal(s.guide.step,0);s.stop();
  finishRun(s,'4');s.remove('SA',true);assert.equal(s.guide.step,1);s.connect('S','A');s.remove('AG',true);
  s.connectPath(['A','C','G']);s.start();s.advance('2');s.stop();assert.equal(s.guide.step,2);assert.equal(s.guide.comparison,null);
  finishRun(s,'3.5');assert.equal(s.guide.step,3);assert.equal(s.guide.comparison.time,'3.5');s.openRecords();assert.equal(s.guide.step,4);
});

test('最初に速い道を見つけても別経路で比較でき、同じ道の繰り返しでは比較を捏造しない',()=>{
  const s=fixture().session;initial(s,['S','A','B','G']);assert.equal(s.guide.firstResult.time,'2.5');assert.equal(s.guide.wireId,'BG');
  s.remove('BG',true);s.connect('B','G');finishRun(s,'3');assert.equal(s.guide.step,2);assert.equal(s.guide.comparison,null);
  s.remove('BG',true);s.remove('AB',true);s.connect('A','G');finishRun(s,'4');assert.equal(s.guide.step,3);assert.equal(s.guide.comparison.time,'4');
});

test('全クリアは各章の先頭へ戻り、分岐の欠けた回路は完了しないが修復して進める',()=>{
  const s=fixture().session;initial(s);s.clearConnections();assert.equal(s.guide.step,0);assert.equal(s.guide.firstResult,null);
  s.connectPath(['S','A','G']);finishRun(s,'4');compare(s);branch(s);const first=structuredClone(s.guide.firstResult),comparison=structuredClone(s.guide.comparison);
  s.clearConnections();assert.equal(s.guide.step,5);assert.equal(s.guide.readyToFinish,false);assert.deepEqual(s.guide.firstResult,first);assert.deepEqual(s.guide.comparison,comparison);
  s.connectPath(['S','A','B','G1']);s.connect('B','G2');finishRun(s,'3');assert.equal(s.result.state,'failed');assert.equal(s.guide.readyToFinish,false);
  s.connectPath(['A','C','G3']);finishRun(s,'3');assert.equal(s.guide.readyToFinish,true);
});

test('比較後の編集は古い記録から次章へ進ませず、新たな実行を必要とする',()=>{
  const s=fixture().session;initial(s);compare(s);assert.equal(s.guide.step,3);
  s.remove('BG',true);s.openRecords();assert.equal(s.guide.step,2);assert.equal(s.guide.comparison,null);assert.throws(()=>s.nextGuideLesson());
  s.connect('B','G');finishRun(s,'2.5');s.openRecords();assert.equal(s.guide.step,4);
});

test('比較の音を聴き直すと新しい実到達で記録案内へ戻り、途中停止では古い比較で進まない',()=>{
  for(const stopShort of [false,true]){
    const s=fixture().session;initial(s);compare(s);const first=structuredClone(s.guide.firstResult),previous=s.guide.comparisonRun,comparison=s.guide.comparison;
    assert.throws(()=>s.start({phaseOffset:'invalid'}));assert.equal(s.guide.step,3);assert.equal(s.guide.comparison,comparison,'Rejected start keeps the earned comparison');
    s.start();assert.equal(s.guide.step,2);assert.equal(s.guide.comparison,null);assert.equal(s.guide.comparisonRun,null);
    if(stopShort){s.advance('1');s.stop();s.openRecords();assert.equal(s.guide.step,2);assert.equal(s.guide.comparison,null);s.start();}
    s.advance('2.5');assert.equal(s.guide.step,3);assert.notEqual(s.guide.comparisonRun,previous);assert.equal(s.guide.comparisonRun,s.run);assert.equal(s.guide.comparison.time,'2.5');assert.deepEqual(s.guide.firstResult,first);
    s.stop();s.openRecords();assert.equal(s.guide.step,4);
  }
});

test('全二章の完了保存が失敗しても練習と控えを保持し、再試行後だけ元の状態へ戻す',()=>{
  const f=fixture(),s=f.session;s.connectPath(['S','A','G']);s.start();s.advance('1');s.view={zoom:2,panX:20,panY:30,recordPage:2,casePage:0};s.selection='A';
  const original={circuit:s.circuit,run:s.run,result:s.result,view:s.view,selection:s.selection};initial(s);compare(s);branch(s);finishRun(s,'3');f.fail();
  assert.throws(()=>s.endGuide('completed'));assert(s.guide);assert.equal(s.guide.readyToFinish,true);assert.equal(f.values.has(STORAGE_KEYS.guides),false);
  f.recover();s.endGuide('completed');for(const [key,value]of Object.entries(original))assert.equal(s[key],value,key+' restored');assert.equal(s.run.status,'paused');assert.equal(f.records.scores().length,0);
  s.beginGuide();assert.equal(s.guide.step,0);s.endGuide('interrupted');assert.equal(s.circuit,original.circuit);
});
