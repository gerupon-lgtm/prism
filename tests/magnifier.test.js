import test from 'node:test';
import assert from 'node:assert/strict';
import { magnifierPlacement,MAGNIFIER_ZOOM } from '../src/ui/magnifier.js';

const area={left:0,top:0,right:390,bottom:580,width:390,height:580};
test('拡大補助は見える範囲を広げる倍率にし、指が離れている間は同じ位置と大きさを保つ',()=>{
  assert.equal(MAGNIFIER_ZOOM,1.4);
  const first=magnifierPlacement({area,obstacles:[],pointer:{x:195,y:500}});
  for(const pointer of [{x:100,y:500},{x:280,y:450},{x:195,y:300}]){
    assert.deepEqual(magnifierPlacement({area,obstacles:[],pointer,previous:first}),first);
  }
});
test('指が窓に近づいた時だけ避け、移動後も窓の大きさを変えない',()=>{
  const first=magnifierPlacement({area,obstacles:[],pointer:{x:195,y:500}});
  const pointer={x:first.x+first.size/2,y:first.y+first.height/2};
  const next=magnifierPlacement({area,obstacles:[],pointer,previous:first});
  assert.notDeepEqual(next,first);assert.equal(next.size,first.size);assert.equal(next.height,first.height);
  assert(pointer.x<next.x-35||pointer.x>next.x+next.size+35||pointer.y<next.y-35||pointer.y>next.y+next.height+35);
});
test('小さい盤面でも窓は盤面内に収まり、場所がないときは表示しない',()=>{
  assert.equal(magnifierPlacement({area:{...area,width:40,right:40},obstacles:[],pointer:{x:10,y:10}}),null);
  const result=magnifierPlacement({area,obstacles:[{left:0,top:0,right:220,bottom:180}],pointer:{x:180,y:500}});
  assert(result.x>=area.left&&result.y>=area.top&&result.x+result.size<=area.right&&result.y+result.height<=area.bottom);
});

test('下側に指がある時は上側を優先し、名前や秒数の保護領域も避ける',()=>{
  const obstacles=[{left:110,top:0,right:280,bottom:160}];
  const result=magnifierPlacement({area,obstacles,pointer:{x:195,y:520}});
  assert(result.y<area.height*.35);
  for(const r of obstacles)assert(Math.min(result.x+result.size,r.right)<=Math.max(result.x,r.left)||Math.min(result.y+result.height,r.bottom)<=Math.max(result.y,r.top));
});
