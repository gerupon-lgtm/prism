import test from 'node:test';
import assert from 'node:assert/strict';
import {directionMarkers} from '../src/ui/edge-directions.js';
const bounds={left:-20,top:-50,right:400,bottom:150};
const overlaps=(a,b)=>Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top);
test('短い線は1つ、長い線は途中と終点手前の2つで進む向きを示す',()=>{
  const short=directionMarkers({points:[{x:0,y:0},{x:80,y:0}],area:bounds});assert.equal(short.length,1);
  const long=directionMarkers({points:[{x:0,y:0},{x:320,y:0}],area:bounds});assert.equal(long.length,2);assert(long[1].distance>260);assert(long[0].distance>80&&long[0].distance<220);
  for(const marker of [...short,...long]){assert(marker.vertices[1].x>marker.vertices[0].x);assert(marker.vertices[1].x>marker.vertices[2].x);}
});
test('秒数カード・パーツ・画面の外を避け、入力した形や障害物を変更しない',()=>{
  const input={points:[{x:0,y:0},{x:320,y:0}],obstacles:[{left:-20,top:-20,right:25,bottom:20},{left:135,top:-20,right:195,bottom:20},{left:285,top:-20,right:340,bottom:20}],area:bounds};
  const before=structuredClone(input),markers=directionMarkers(input);assert.equal(markers.length,2);
  for(const marker of markers)for(const box of input.obstacles)assert(!overlaps(marker.rect,box));assert.deepEqual(input,before);
});
test('斜めの曲線の終点では、その場所の線に沿って矢印を向ける',()=>{
  const markers=directionMarkers({points:[{x:0,y:100},{x:100,y:0},{x:200,y:100}],area:bounds});assert.equal(markers.length,2);
  const last=markers.at(-1),tip=last.vertices[1];assert(tip.x>last.vertices[0].x&&tip.y>last.vertices[0].y);assert(tip.x>last.vertices[2].x&&tip.y>last.vertices[2].y);
});
test('逆向きと縦向きにも実際の進行方向を示し、双方向は両端を示す',()=>{
  const reversed=directionMarkers({points:[{x:320,y:0},{x:0,y:0}],area:bounds});assert(reversed.every(m=>m.vertices[1].x<m.vertices[0].x));
  const vertical=directionMarkers({points:[{x:20,y:0},{x:20,y:100}],area:bounds});assert.equal(vertical.length,1);assert(vertical[0].vertices[1].y>vertical[0].vertices[0].y);
  const both=directionMarkers({points:[{x:0,y:0},{x:320,y:0}],bidirectional:true,area:bounds});assert.equal(both.length,2);assert.deepEqual(both.map(m=>m.direction).sort(),[-1,1]);assert(!overlaps(both[0].rect,both[1].rect));
});
test('潰れた線と隠れた線には偽の向きを作らない',()=>{
  assert.deepEqual(directionMarkers({points:[{x:0,y:0},{x:0,y:0}]}),[]);
  assert.deepEqual(directionMarkers({points:[{x:0,y:0},{x:320,y:0}],obstacles:[bounds]}),[]);
});
test('同じ区間を通る別経路の矢印だけを理由に向きを消さない',()=>{
  const markers=directionMarkers({points:[{x:0,y:0},{x:320,y:0}],otherMarkers:[bounds],area:bounds});assert.equal(markers.length,2);
});
test('短い隙間では小さい矢印を1つ置き、パーツに重ねない',()=>{
  const boxes=[{left:-20,top:-30,right:45,bottom:30},{left:61,top:-30,right:120,bottom:30}];
  const markers=directionMarkers({points:[{x:0,y:0},{x:100,y:0}],obstacles:boxes});assert.equal(markers.length,1);assert.equal(markers[0].size,8);for(const b of boxes)assert(!overlaps(markers[0].rect,b));
});
