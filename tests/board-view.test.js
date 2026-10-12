import test from 'node:test';
import assert from 'node:assert/strict';
import { Board } from '../src/ui/board.js';
import { challenges } from '../src/content/challenges.js';
import { frameRotation } from '../src/ui/orientation.js';

test('縦置きの表示は出発点が下・祭壇が上、元の回路座標は変えない',()=>{
  const view={projectionScale:1},before=structuredClone(challenges[0].nodes);
  const source=before.find(node=>node.kind==='source'),goal=before.find(node=>node.kind==='goal');
  assert.deepEqual(Board.prototype.position.call(view,source),{x:500,y:1440});
  assert.deepEqual(Board.prototype.position.call(view,goal),{x:500,y:208});
  assert.deepEqual(challenges[0].nodes,before);
});

test('追加・移動の表示座標を元の保存座標へ戻す',()=>{
  const view={projectionScale:1};
  assert.deepEqual(Board.prototype.coordinates.call(view,{x:500,y:1440}),{x:.5,y:.1});
  assert.deepEqual(Board.prototype.coordinates.call(view,{x:250,y:880}),{x:.25,y:.45});
});

test('大きい保存座標の表示と逆変換も同じ倍率を保つ',()=>{
  const view={projectionScale:10000},node={x:2500,y:7500};
  const at=Board.prototype.position.call(view,node);assert.deepEqual(at,{x:250,y:400});
  assert.deepEqual(Board.prototype.coordinates.call(view,at),node);
});

test('縦・左右の横置きは物理方向を保つ回転にする',()=>{
  const input={coarse:true,width:844,height:390};
  assert.equal(frameRotation({...input,type:'portrait-primary',angle:0}),0);
  assert.equal(frameRotation({...input,type:'landscape-primary',angle:90}),-90);
  assert.equal(frameRotation({...input,type:'landscape-secondary',angle:270}),90);
  assert.equal(frameRotation({...input,type:'portrait-secondary',angle:180}),180);
});

test('横が自然向きの端末もportrait-primaryを基準にする',()=>{
  const input={coarse:true,width:1024,height:768};
  assert.equal(frameRotation({...input,type:'portrait-primary',angle:90}),0);
  assert.equal(frameRotation({...input,type:'portrait-primary',angle:270}),0);
  assert.equal(frameRotation({...input,type:'landscape-primary',angle:0,portraitAngle:270}),-90);
  assert.equal(frameRotation({...input,type:'landscape-secondary',angle:180,portraitAngle:270}),90);
  assert.equal(frameRotation({...input,type:'landscape-primary',angle:0}),90);
  assert.equal(frameRotation({...input,type:'landscape-secondary',angle:180}),-90);
});

test('旧方向API・キーボード・PC表示を区別する',()=>{
  assert.equal(frameRotation({coarse:true,legacyAngle:90,width:844,height:390}),-90);
  assert.equal(frameRotation({coarse:true,legacyAngle:-90,width:844,height:390}),90);
  assert.equal(frameRotation({coarse:true,type:'portrait-primary',angle:0,width:390,height:220,editing:true}),0);
  assert.equal(frameRotation({width:390,height:220,editing:true,previous:0}),0);
  assert.equal(frameRotation({width:844,height:390}),-90);
});
