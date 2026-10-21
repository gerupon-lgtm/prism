import test from 'node:test';
import assert from 'node:assert/strict';
import {Board} from '../src/ui/board.js';

function board(){
  const events=[],circuit={nodes:[]},doc={hidden:false,querySelector:()=>null};
  const b={session:{circuit,editable:true,selection:null},pointers:new Map(),gesture:null,
    element:{ownerDocument:doc,getClientRects:()=>[{}],closest:()=>null},
    cancelMirrorSelection:Board.prototype.cancelMirrorSelection,
    beginMirrorAim:(...args)=>events.push(args),render(){},changed(){}};
  return {b,events,doc};
}

test('鏡までの配線を解放時に確定し、即時の選択を消してから自動選択を予約する',()=>{
  const events=[],b={gesture:{kind:'mirror-arrival',moved:true,route:['S','A','M']},pointers:new Map([[1,{}]]),magnifier:{hide(){}},stopHold(){},move(){},setWirePreview(){},session:{editable:true,connectPath(route){events.push([...route]);this.selection='M';}},queueMirrorSelection(id,from){assert.equal(this.session.selection,null);events.push([id,from]);},render(){},changed(){},notify:assert.fail};
  Board.prototype.up.call(b,{pointerId:1});assert.deepEqual(events,[['S','A','M'],['M','A']]);assert.equal(b.gesture,null);
});

test('結線後の自動選択は100ms待ち、待機中は鏡を選択しない',t=>{
  t.mock.timers.enable({apis:['setTimeout']});const {b,events}=board();
  Board.prototype.queueMirrorSelection.call(b,'M','A');
  t.mock.timers.tick(99);assert.deepEqual(events,[]);
  t.mock.timers.tick(1);assert.deepEqual(events,[['M','A']]);
  t.mock.timers.tick(1000);assert.equal(events.length,1);
});

test('新しい入力・取り消し・別の回路・実行開始・非表示・画面遷移では後から選択しない',t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  for(const stop of [b=>b.cancelMirrorSelection(),b=>b.session.circuit={},b=>b.session.editable=false,b=>b.pointers.set(1,{}),b=>b.gesture={},b=>b.element.ownerDocument.hidden=true,b=>b.element.getClientRects=()=>[],b=>b.element.closest=()=>({}),b=>b.element.ownerDocument.querySelector=()=>({})]){
    const {b,events}=board();Board.prototype.queueMirrorSelection.call(b,'M','A');stop(b);t.mock.timers.tick(100);assert.deepEqual(events,[]);
  }
});
