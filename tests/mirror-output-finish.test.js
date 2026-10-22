import test from 'node:test';
import assert from 'node:assert/strict';
import {Board} from '../src/ui/board.js';

function board({moved=true,target='C',same=false,route=['M']}={}){
  const events=[],aim={id:'M',target,control:{x:1,y:2},controlScreen:{x:3,y:4}};
  const b={gesture:{kind:'mirror',moved,rotated:moved,route},mirrorAim:aim,pointers:new Map([[1,{}]]),
    magnifier:{hide(){}},stopHold(){},move(){},setWirePreview(){},
    session:{editable:true,selection:'M',setMirrorDirection:(...args)=>events.push(['output',...args]),connectPath:path=>events.push(['path',...path])},
    mirrorIsConnected:()=>same,connected:id=>events.push(['sound',id]),
    beginMirrorAim(){events.push(['aim']);this.mirrorAim={...aim};},render(){},changed(){},notify:assert.fail};
  return {b,events};
}

test('鏡の出力を解放して確定したら回転操作を閉じ、次の結線先を選ぶ',()=>{
  for(const same of [false,true]){
    const {b,events}=board({same});Board.prototype.up.call(b,{pointerId:1});
    assert.equal(b.mirrorAim,null);assert.equal(b.session.selection,'C');assert.equal(b.gesture,null);
    assert.deepEqual(events,[['output','M','C'],...(!same?[['sound','C']]:[])]);
  }
});

test('照準を外した解放と回転しないタップでは回転操作と盤の位置を保つ',()=>{
  for(const options of [{target:null},{moved:false}]){
    const {b,events}=board(options);const {control,controlScreen}=b.mirrorAim;
    Board.prototype.up.call(b,{pointerId:1});assert(b.mirrorAim);
    assert.equal(b.mirrorAim.control,control);assert.equal(b.mirrorAim.controlScreen,controlScreen);
    assert.deepEqual(events,[['aim']]);
  }
});

test('鏡までの連続結線と反射先を確定しても次の操作を妨げない',()=>{
  const {b,events}=board({route:['S','A','M']});Board.prototype.up.call(b,{pointerId:1});
  assert.deepEqual(events,[['path','S','A','M','C'],['sound','C']]);
  assert.equal(b.mirrorAim,null);assert.equal(b.session.selection,'C');
});

test('中心内や半径方向への移動だけでは出力を確定せず、回転操作を続けられる',()=>{
  const {b,events}=board();b.gesture.rotated=false;
  Board.prototype.up.call(b,{pointerId:1});assert(b.mirrorAim);
  assert.deepEqual(events,[['aim']]);
});
