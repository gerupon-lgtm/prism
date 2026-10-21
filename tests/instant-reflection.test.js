import test from 'node:test';
import assert from 'node:assert/strict';
import {createCircuit,shortestPath} from '../src/core/circuit.js';
import {Simulation} from '../src/core/simulation.js';
import {Session} from '../src/app/session.js';
import {LocalRecords,circuitFile} from '../src/core/storage.js';
import {Board} from '../src/ui/board.js';
import {challenges} from '../src/content/challenges.js';
import {drawChallenge} from '../src/content/challenge-draw.js';
import {matchesChallengeScore} from '../src/core/challenge-identity.js';

const chain=()=>({mode:'spread',target:'G',nodes:[{id:'S',kind:'source',process:'0'},{id:'M',kind:'mirror',reflectTo:'N'},{id:'N',kind:'mirror',reflectTo:'G'},{id:'G',kind:'goal'}],edges:[{id:'SM',from:'S',to:'M',time:'0.5'},{id:'MN',from:'M',to:'N',time:'0'},{id:'NG',from:'N',to:'G',time:'0'}]});

test('鏡は初期値0秒で、反射の連鎖は同じ時刻に届き、最短経路と記録も一致する',()=>{
  const input=chain(),c=createCircuit(input),run=new Simulation(input);
  assert(c.raw.nodes.filter(n=>n.kind==='mirror').every(n=>n.process==='0'));
  assert.equal(c.time.format(shortestPath(c,'G').time),'0.5');run.advanceUntil('1');
  assert.deepEqual(run.arrivals('G').map(r=>r.time),['0.5']);assert(run.exhausted);
  for(const id of ['M','N']){
    const rows=run.records.filter(r=>r.node===id&&['arrival','process-start','process-end','travel'].includes(r.type));
    assert.equal(rows.length,4);assert(rows.every(r=>r.time==='0.5'));
    assert.equal(rows.find(r=>r.type==='process-start').wait,'0');
  }
});

test('鏡から出る道以外の0秒と、0.1秒未満の正の移動時間は許可しない',()=>{
  for(const [id,time] of [['SM','0'],['SM','0.09'],['MN','0.09']]){
    const input=chain();input.edges.find(e=>e.id===id).time=time;
    assert.throws(()=>createCircuit(input),/0.1秒|鏡/);
  }
});

test('同時に届いた二つの光を鏡で待たせず、同じ時刻に鐘へ反射する',()=>{
  const input={mode:'spread',target:'G',nodes:[{id:'S',kind:'source',process:'0'},{id:'A',kind:'prism',process:'0'},{id:'M',kind:'mirror',reflectTo:'G'},{id:'G',kind:'goal'}],edges:[{id:'SM',from:'S',to:'M',time:'1'},{id:'SA',from:'S',to:'A',time:'0.5'},{id:'AM',from:'A',to:'M',time:'0.5'},{id:'MG',from:'M',to:'G',time:'0'}]};
  const run=new Simulation(input);assert(run.hasFutureArrival('G'));run.advanceUntil('2');
  assert.deepEqual(run.arrivals('G').map(r=>r.time),['1','1']);
  assert(run.records.filter(r=>r.node==='M'&&r.type==='process-start').every(r=>r.wait==='0'&&r.finishTime==='1'));
});

test('対象7面の全56出題は鏡と出力が0秒になり、旧成績を区別する',()=>{
  const ids=['Q35','Q36','Q37','Q38','Q39','Q40','Q46'];
  for(const id of ids){
    const c=challenges.find(c=>c.id===id);assert.equal(c.version,id==='Q35'?4:id==='Q46'?2:3);
    assert(c.nodes.filter(n=>n.kind==='mirror').every(n=>n.process==='0'));
    assert(!matchesChallengeScore({rule:'delivery-all@1',challenge:`${id}@${c.version-1}/random-1-legacy`},c));
    for(let i=0;i<8;i++){
      const draw=drawChallenge(c,{random:()=>i/8});
      assert(draw.candidates.filter(e=>draw.nodes.some(n=>n.id===e.from&&n.kind==='mirror')).every(e=>e.time==='0'));
    }
  }
});

test('0秒で回り続ける三枚の鏡は拒否し、待機のある循環は維持する',()=>{
  const input=chain();input.nodes.splice(3,0,{id:'P',kind:'mirror',reflectTo:'M'});input.nodes[2].reflectTo='P';
  input.edges[2]={id:'NP',from:'N',to:'P',time:'0'};input.edges.push({id:'PM',from:'P',to:'M',time:'0'});
  const loop=new Simulation(input);assert.throws(()=>loop.advanceNext(),/時間が進まない/);assert(loop.records.length<50);
  input.nodes[1].process='0.5';assert.doesNotThrow(()=>createCircuit(input));
  const run=new Simulation(input);run.advanceUntil('3');assert.equal(run.format(),'3');
});

test('開閉待ちで時刻が進む0秒循環は通し、実際に同時刻で回る循環だけ停止する',()=>{
  const input={mode:'spread',target:'G',nodes:[{id:'S',kind:'source',process:'0'},{id:'M',kind:'mirror',reflectTo:'A'},{id:'A',kind:'prism',process:'0',gate:{period:'2',open:'1',phase:'0'}},{id:'N',kind:'mirror',reflectTo:'B'},{id:'B',kind:'prism',process:'0',gate:{period:'2',open:'1',phase:'1'}},{id:'G',kind:'goal'}],edges:[{id:'SM',from:'S',to:'M',time:'0.5'},{id:'MA',from:'M',to:'A',time:'0'},{id:'NA',from:'N',to:'A',time:'0',bidirectional:true},{id:'NB',from:'N',to:'B',time:'0'},{id:'MB',from:'M',to:'B',time:'0',bidirectional:true}]};
  const run=new Simulation(input);run.advanceUntil('8');assert.equal(run.format(),'8');assert(!run.exhausted);
  input.nodes.find(n=>n.id==='B').gate.phase='0';
  // Splitting creates new particle IDs; the instantaneous path must follow each child.
  input.edges.push({id:'AG',from:'A',to:'G',time:'0.1'});
  const blocked=new Simulation(input);assert.throws(()=>blocked.advanceUntil('2'),/時間が進まない/);assert(blocked.records.length<100);
});

test('同じ双方向線への即時の折返しは従来どおり通らず、0秒の循環と誤認しない',()=>{
  const input=chain();input.nodes[2].reflectTo='M';input.edges[1].bidirectional=true;input.edges.pop();
  const run=new Simulation(input);run.advanceUntil('1');assert(run.exhausted);assert.equal(run.arrivals().length,0);
});

test('自由で新しくつなぐ鏡の出力は0秒、保存済みの明示した時間は保持する',()=>{
  const values=new Map(),records=new LocalRecords({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}),s=new Session(records);
  const input=chain();input.edges=[];s.replace({fileText:JSON.stringify(circuitFile(input,'瞬間反射'))});
  s.connect('S','M');s.setMirrorDirection('M','N');s.setMirrorDirection('N','G');
  assert.deepEqual(s.circuit.edges.map(e=>e.time),['1','0','0']);
  const saved=chain();saved.nodes[1].process='0.5';saved.edges[1].time='1';
  s.replace({fileText:JSON.stringify(circuitFile(saved,'旧設定'))},{choice:'discard'});
  assert.equal(s.circuit.nodes[1].process,'0.5');assert.equal(s.circuit.edges[1].time,'1');
});

test('0秒の移動途中で負荷停止しても粒の描画で0除算しない',t=>{
  const run=new Simulation(chain());run.advanceNext({shouldPause:r=>[...r.particles.values()].some(p=>p.status==='moving'&&p.due===r.clock)});
  assert.equal(run.pauseReason,'load');
  const previous=globalThis.document,parts=[];globalThis.document={createElementNS:()=>({attrs:{},setAttribute(k,v){this.attrs[k]=v;},append(){}})};
  t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;});
  const curve={a:{x:0,y:0},b:{x:100,y:100},control:{x:50,y:50}};
  const b={session:{run},particleLayer:{replaceChildren(){},append:p=>parts.push(p)},updateGoalMarkers(){},world:{querySelectorAll:()=>[]},timeLayoutSignature:'',curves:new Map(run.circuit.raw.edges.map(e=>[e.id,curve])),onCurve:Board.prototype.onCurve};
  assert.doesNotThrow(()=>Board.prototype.particles.call(b));assert(parts.some(p=>p.attrs.transform==='translate(100 100)'));
});
