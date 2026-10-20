import test from 'node:test';
import assert from 'node:assert/strict';
import {createCircuit,shortestPath} from '../src/core/circuit.js';
import {Simulation} from '../src/core/simulation.js';
import {Session} from '../src/app/session.js';
import {LocalRecords,circuitFile,readCircuitFile} from '../src/core/storage.js';

const mirrorCircuit=()=>({mode:'spread',target:'G',
  nodes:[{id:'S',kind:'source',process:'0'},{id:'M',kind:'mirror',reflectTo:'A'},{id:'A',kind:'prism',process:'0.5'},{id:'G',kind:'goal',process:'0'},{id:'H',kind:'goal',process:'0'}],
  edges:[{id:'SM',from:'S',to:'M',time:'1'},{id:'MA',from:'M',to:'A',time:'0.2'},{id:'MG',from:'M',to:'G',time:'0.4'},{id:'AG',from:'A',to:'G',time:'0.2'},{id:'AH',from:'A',to:'H',time:'0.3'}]});

test('読み込んだ鏡の反射先へ並行する複数の有効配線は受け付けず、分岐を防ぐ',()=>{
  const input=mirrorCircuit();input.nodes[1].reflectTo='G';
  input.edges.push({id:'MG2',from:'G',to:'M',bidirectional:true,time:'0.6'});
  assert.throws(()=>createCircuit(input),/鏡の反射先への配線/);
  const file=circuitFile(mirrorCircuit(),'不正な鏡');file.circuit=input;
  assert.throws(()=>readCircuitFile(JSON.stringify(file)),/鏡の反射先への配線/);
  input.edges.at(-1).enabled=false;
  const run=new Simulation(input);run.advanceUntil('10');assert.equal(run.arrivals('G').length,1);
});

test('鏡は選んだ一方向だけへ反射し、実行・今後の到達・最短経路が同じ向きを使う',()=>{
  const input=mirrorCircuit(),circuit=createCircuit(input);
  assert.equal(circuit.raw.nodes.find(node=>node.id==='M').process,'0.5');
  assert.equal(circuit.raw.nodes.find(node=>node.id==='M').reflectTo,'A');
  assert.deepEqual(shortestPath(circuit,'G').edges,['SM','MA','AG']);
  const run=new Simulation(input);assert.equal(run.hasFutureArrival('G'),true);assert.equal(run.hasFutureArrival('H'),true);
  run.advanceUntil('10');assert.deepEqual(run.arrivals('G').map(row=>row.time),['2.4']);assert.deepEqual(run.arrivals('H').map(row=>row.time),['2.5']);
  assert.equal(run.records.some(row=>row.type==='branch'&&row.node==='M'),false);
  input.nodes[1].reflectTo='G';input.mode='fastest';
  const direct=new Simulation(input);assert.deepEqual(shortestPath(direct.circuit,'G').edges,['SM','MG']);
  direct.advanceUntil('10');assert.deepEqual(direct.arrivals('G').map(row=>row.time),['1.9']);assert.equal(direct.hasFutureArrival('H'),false);
});

function fixture({free=false}={}) {
  const values=new Map(),records=new LocalRecords({getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)});
  const session=new Session(records),input=mirrorCircuit();
  if(free)session.replace({fileText:JSON.stringify(circuitFile(input,'鏡の回路'))});
  else {
    session.challenge={id:'mirror-test',version:1,name:'鏡の向き',type:'time',goal:'G',baseline:'1.9',maxDuration:'30',limit:2,nodes:input.nodes,candidates:input.edges};
    session.circuit=createCircuit({...input,edges:[]}).raw;
  }
  return {session,records,values};
}

test('本数上限いっぱいでも鏡からの配線を一度で置き換え、無効な候補では全条件を保持する',()=>{
  const {session:s}=fixture();s.connect('S','M');s.connect('M','G');
  assert.equal(s.circuit.nodes.find(node=>node.id==='M').reflectTo,'G');
  const replacement=s.setMirrorDirection('M','A');assert.equal(replacement,'MA');assert.equal(s.circuit.edges.length,2);
  assert.deepEqual(s.circuit.edges.map(edge=>edge.id),['SM','MA']);assert.equal(s.circuit.nodes.find(node=>node.id==='M').reflectTo,'A');
  const before=structuredClone(s.circuit),selection=s.selection;
  for(const [id,target] of [['M','H'],['M','M'],['M','missing'],['A','G'],['missing','G']]) {
    assert.throws(()=>s.setMirrorDirection(id,target));assert.deepEqual(s.circuit,before);assert.equal(s.selection,selection);
  }
  assert.throws(()=>s.connectPath(['M','G','missing']));assert.deepEqual(s.circuit,before);
  assert.throws(()=>s.connect('A','G'));assert.deepEqual(s.circuit,before);
});

test('自由に読み込んだ鏡は使用状態を変えられ、反射先の点を消した時は方向を未選択に戻す',()=>{
  const {session:s}=fixture({free:true});
  s.setEnabled('M',false);assert.equal(s.circuit.nodes.find(node=>node.id==='M').enabled,false);
  s.start();s.advance('10');assert.equal(s.run.arrivals('G').length,0);s.stop();
  s.setEnabled('M',true);s.remove('A',true);
  assert.equal(s.circuit.nodes.find(node=>node.id==='M').reflectTo,null);
  assert.equal(s.circuit.edges.some(edge=>edge.from==='A'||edge.to==='A'),false);
  s.start();s.advance('10');assert.equal(s.run.arrivals('G').length,0);
});

test('鏡の向きが未選択か、その向きの道がない時は光を出さない',()=>{
  for(const state of ['missing','null','unwired']) {
    const input=mirrorCircuit();
    if(state==='missing')delete input.nodes[1].reflectTo;
    if(state==='null')input.nodes[1].reflectTo=null;
    if(state==='unwired')input.edges=input.edges.filter(edge=>edge.id!=='MA');
    const run=new Simulation(input);assert.equal(run.hasFutureArrival('G'),false);assert.equal(shortestPath(run.circuit,'G'),null);
    run.advanceUntil('10');assert.equal(run.arrivals().length,0);assert(run.records.some(row=>row.type==='deadend'&&row.node==='M'));
  }
});

test('反射先は存在する別の点に限定し、未配線の点を選ぶ状態は保持する',()=>{
  for(const invalid of ['M','missing','',123,{},[]]) {
    const input=mirrorCircuit();input.nodes[1].reflectTo=invalid;
    const original=structuredClone(input);assert.throws(()=>createCircuit(input));assert.deepEqual(input,original);
  }
  const input=mirrorCircuit();input.nodes[1].reflectTo='H';
  const compiled=createCircuit(input);assert.equal(compiled.raw.nodes[1].reflectTo,'H');assert.equal(shortestPath(compiled,'H'),null);
});

test('鏡と選択方向をファイルと保存枠で往復し、旧形式の点には項目を追加しない',()=>{
  const input=mirrorCircuit(),file=circuitFile(input,'方向を保存'),decoded=readCircuitFile(JSON.stringify(file));
  assert.deepEqual(decoded,file);assert.equal(decoded.circuit.nodes[1].reflectTo,'A');
  assert.equal(Object.hasOwn(decoded.circuit.nodes[0],'reflectTo'),false);
  const {session:s,records}=fixture({free:true});s.saveCircuit('保存した鏡',{id:'mirror-slot'});
  assert.deepEqual(records.slots()[0].circuit,s.circuit);
  const original=structuredClone(s.circuit);s.clearConnections();s.replace({slotId:'mirror-slot'},{choice:'discard'});
  assert.deepEqual(s.circuit,original);
});

test('同じ配線済み方向は選択だけにし、全配線クリア後も向きを残して再接続できる',()=>{
  const {session:s}=fixture({free:true});const before=structuredClone(s.circuit);
  assert.equal(s.setMirrorDirection('M','A'),'MA');assert.equal(s.selection,'M');assert.equal(s.dirty,false);assert.deepEqual(s.circuit,before);
  s.clearConnections();assert.equal(s.circuit.edges.length,0);assert.equal(s.circuit.nodes[1].reflectTo,'A');
  const edge=s.setMirrorDirection('M','G');assert.equal(s.circuit.nodes[1].reflectTo,'G');
  assert.equal(s.circuit.edges[0].id,edge);assert.equal(s.circuit.edges[0].from,'M');assert.equal(s.circuit.edges[0].to,'G');
});

test('鏡への入力配線は向きを変えず、鏡からの変更は他の点の配線を残す',()=>{
  const challenge=fixture().session;challenge.connect('S','M');assert.equal(challenge.circuit.nodes[1].reflectTo,'A');
  const {session:s}=fixture({free:true}),unrelated=s.circuit.edges.filter(edge=>edge.from!=='M');
  const edgeId=s.setMirrorDirection('M','H');assert.deepEqual(s.circuit.edges.filter(edge=>edge.from!=='M'),unrelated);
  assert.deepEqual(s.circuit.edges.filter(edge=>edge.from==='M').map(edge=>edge.id),[edgeId]);
  const run=s.start();assert.equal(run.hasFutureArrival('H'),true);assert.equal(run.hasFutureArrival('G'),false);
  const before=structuredClone(s.circuit);assert.throws(()=>s.setMirrorDirection('M','G'));assert.deepEqual(s.circuit,before);
  s.pause();assert.throws(()=>s.setMirrorDirection('M','G'));s.resume();s.advance('10');
  assert.deepEqual(run.arrivals('H').map(row=>row.time),['2.5']);s.stop();
  const result=s.exportResult();s.setMirrorDirection('M','G');assert.equal(s.circuit.nodes[1].reflectTo,'G');assert.deepEqual(s.exportResult(),result);
});

test('鏡でも通常の処理待ちを使い、同時に届く光を選んだ方向へ順番に出す',()=>{
  const input=mirrorCircuit();input.nodes[1].reflectTo='G';
  input.edges=[input.edges[0],input.edges[2],{id:'SA',from:'S',to:'A',time:'0.2'},{id:'AM',from:'A',to:'M',time:'0.3'}];
  const run=new Simulation(input);run.advanceUntil('10');
  assert.deepEqual(run.arrivals('G').map(row=>row.time),['1.9','2.4']);
  assert(run.records.some(row=>row.type==='process-start'&&row.node==='M'&&row.wait==='0.5'));
  assert.equal(run.records.some(row=>row.type==='branch'&&row.node==='M'),false);
});

test('両方向の道も鏡側では選んだ反射先だけへ通し、入力側の道は残す',()=>{
  const input=mirrorCircuit();input.nodes[1].reflectTo='G';
  input.edges=input.edges.map(edge=>edge.id==='MG'?{...edge,from:'G',to:'M',bidirectional:true}:edge);
  const run=new Simulation(input);assert.deepEqual(shortestPath(run.circuit,'G').edges,['SM','MG']);
  run.advanceUntil('10');assert.deepEqual(run.arrivals('G').map(row=>row.time),['1.9']);
  const {session:s}=fixture({free:true});s.circuit=createCircuit(input).raw;
  assert.equal(s.setMirrorDirection('M','G'),'MG');assert.equal(s.circuit.edges.find(edge=>edge.id==='MG').from,'G');
});

test('別の反射先から入力側の双方向線へ向け直す時も、既存線をそのまま再利用する',()=>{
  for(const operation of ['direction','drag']){
    const input=mirrorCircuit();input.edges=input.edges.map(edge=>edge.id==='MG'?{...edge,from:'G',to:'M',bidirectional:true}:edge);
    const {session:s}=fixture({free:true});s.circuit=createCircuit(input).raw;
    if(operation==='direction')assert.equal(s.setMirrorDirection('M','G'),'MG');else assert.equal(s.connect('M','G'),'MG');
    assert.equal(s.circuit.nodes[1].reflectTo,'G');assert.equal(s.circuit.edges.filter(edge=>edge.id==='MG').length,1);
    assert.equal(s.circuit.edges.some(edge=>edge.id==='MA'),false);
    const run=s.start();s.advance('10');assert.deepEqual(run.arrivals('G').map(row=>row.time),['1.9']);
  }
});
