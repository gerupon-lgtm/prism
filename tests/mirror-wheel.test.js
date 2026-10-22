import test from 'node:test';
import assert from 'node:assert/strict';
import {wheelDelta} from '../src/ui/mirror-optics.js';
import {Board} from '../src/ui/board.js';

const rad=degrees=>degrees*Math.PI/180;
const point=(degrees,radius=32)=>({x:radius*Math.cos(rad(degrees)),y:radius*Math.sin(rad(degrees))});
const near=(actual,expected)=>assert(Math.abs(actual-expected)<1e-10,`${actual} differs from ${expected}`);

test('円周のどこからでも、指を置いた向きではなくなぞった角度だけ回す',()=>{
  for(const start of [-170,-90,0,90,170]){
    near(wheelDelta(point(start),point(start+20)),rad(20));
    near(wheelDelta(point(start),point(start-20)),rad(-20));
    near(wheelDelta(point(start),point(start)),0);
  }
  near(wheelDelta(point(179),point(-179)),rad(2));
  near(wheelDelta(point(-179),point(179)),rad(-2));
});

test('円周から指が外れても、中心を通らなければ回転を続けられる',()=>{
  near(wheelDelta(point(0),point(20,80)),rad(20));
  near(wheelDelta(point(20,80),point(40,24)),rad(20));
  near(wheelDelta(point(40,24),point(40,90)),0);
});

test('中心からの開始・中心通過・イベント間での中心横断では向きを飛ばさない',()=>{
  assert.equal(wheelDelta(null,point(90)),0);
  assert.equal(wheelDelta({x:0,y:0},point(90)),0);
  assert.equal(wheelDelta(point(0),{x:5,y:0}),0);
  assert.equal(wheelDelta({x:5,y:0},point(180)),0);
  assert.equal(wheelDelta(point(0),point(180)),0);
  assert.equal(wheelDelta(point(-80),point(80)),0);
});

test('実際の移動処理で中心通過を保留し、次の円周操作から滑らかに再開する',()=>{
  for(const scale of [.4,1,2]){
    const rotated=[],b={pointers:new Map([[1,{}]]),gesture:{kind:'mirror',moved:true,x:0,y:0,surface:rad(30),rotationOrigin:{x:0,y:0},rotationPoint:point(0)},
      mirrorAim:{origin:{x:0,y:0}},session:{editable:true,circuit:{edges:[]}},world:{getScreenCTM:()=>({a:scale,b:0})},
      location:(x,y)=>({x:x/scale,y:y/scale}),stopHold(){},aimMirror(angle){rotated.push(angle);},magnifier:{hide(){}}};
    const move=at=>Board.prototype.move.call(b,{pointerId:1,clientX:at.x,clientY:at.y,pointerType:'touch'});
    move(point(20));near(b.gesture.surface,rad(50));
    move({x:0,y:0});move(point(180));near(b.gesture.surface,rad(50));
    move(point(200));near(b.gesture.surface,rad(70));
    assert.equal(rotated.length,2);
  }
});
