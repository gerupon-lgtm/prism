import test from 'node:test';
import assert from 'node:assert/strict';
import {reflect,surfaceFor,angleGap,snapTarget,unalignedAngle,placeMirrorControl} from '../src/ui/mirror-optics.js';

test('空きがある場所では鏡から110pxの近い回転盤を選ぶ',()=>{
  const origin={x:400,y:400},at=placeMirrorControl({bounds:{left:0,top:0,right:800,bottom:800},origin});
  assert(Math.hypot(at.x-origin.x,at.y-origin.y)<=115);
});

test('離した回転盤は画面内でパーツを避け、同じ条件なら同じ場所を選ぶ',()=>{
  const bounds={left:0,top:0,right:390,bottom:500},origin={x:195,y:250};
  const obstacles=[{left:130,top:195,right:260,bottom:305},{left:20,top:20,right:150,bottom:150}];
  const at=placeMirrorControl({bounds,origin,obstacles});
  assert(at.x>=58&&at.x<=332&&at.y>=58&&at.y<=442);
  assert(Math.hypot(at.x-origin.x,at.y-origin.y)>120);
  assert(Math.hypot(at.x-origin.x,at.y-origin.y)<220);
  assert(Math.hypot(Math.max(20-at.x,0,at.x-150),Math.max(20-at.y,0,at.y-150))>=58);
  assert.deepEqual(placeMirrorControl({bounds,origin,obstacles}),at);
  const small=placeMirrorControl({bounds:{left:0,top:0,right:180,bottom:160},origin,obstacles:[]});
  assert(small.x>=58&&small.x<=122&&small.y>=58&&small.y<=102);
});

const rad=degrees=>degrees*Math.PI/180;
const target=(id,degrees)=>({id,angle:rad(degrees)});
const near=(actual,expected)=>assert(angleGap(actual,expected)<1e-10,`${actual} differs from ${expected}`);

test('鏡面を基準に入射と反射が対称となり、鏡の回転量の2倍だけ反射先が変わる',()=>{
  near(reflect(0,Math.PI/4),Math.PI/2);
  near(reflect(Math.PI/2,0),-Math.PI/2);
  near(reflect(rad(20),rad(70)),rad(120));
  near(reflect(rad(20),rad(85)),rad(150));
  near(reflect(rad(20),rad(70)+Math.PI),rad(120));
});

test('反射方向から鏡面を求められ、折返し境界と反対方向でも成立する',()=>{
  for(const incoming of [-1080,-180,-179,-90,0,90,179,180,1080]){
    for(const outgoing of [-1080,-180,-179,-90,0,90,179,180,1080]){
      const surface=surfaceFor(rad(incoming),rad(outgoing));
      assert(surface>=-Math.PI/2&&surface<Math.PI/2);
      const reflected=reflect(rad(incoming),surface);
      assert(reflected>=-Math.PI&&reflected<Math.PI);
      near(reflected,rad(outgoing));
    }
  }
  assert.equal(reflect(0,Math.PI/2),-Math.PI);
  near(angleGap(rad(179),rad(-179)),rad(2));
  assert.equal(angleGap(0,Math.PI),Math.PI);
  assert.equal(angleGap(4*Math.PI,0),0);
  assert(Number.isFinite(reflect(Number.MAX_VALUE,Number.MAX_VALUE)));
  assert(Number.isFinite(surfaceFor(Number.MAX_VALUE,-Number.MAX_VALUE)));
});

test('22度まで新しい相手を捉え、円周の境界をまたぐ候補も扱う',()=>{
  const targets=[target('A',0)];
  assert.equal(snapTarget(rad(21),targets),'A');
  assert.equal(snapTarget(rad(22),targets),'A');
  assert.equal(snapTarget(rad(22.01),targets),null);
  assert.equal(snapTarget(rad(-179),[target('B',179)]),'B');
  assert.equal(snapTarget(0,[]),null);
  assert.equal(snapTarget(0,targets,'missing'),'A');
});

test('一度選んだ相手は30度まで保持し、別候補が4度より明確に近い時だけ切り替える',()=>{
  assert.equal(snapTarget(rad(29),[target('A',0)],'A'),'A');
  assert.equal(snapTarget(rad(30),[target('A',0)],'A'),'A');
  assert.equal(snapTarget(rad(30.01),[target('A',0)],'A'),null);
  const targets=[target('A',0),target('B',40)];
  assert.equal(snapTarget(rad(22),targets,'A'),'A');
  assert.equal(snapTarget(rad(22.01),targets,'A'),'B');
  assert.equal(snapTarget(rad(18),targets,'B'),'B');
  assert.equal(snapTarget(rad(17.99),targets,'B'),'A');
});

test('近さの差が4度以内なら勝手に相手を選ばず、同じ向きの相手も区別を保つ',()=>{
  const targets=[target('A',0),target('B',40)];
  assert.equal(snapTarget(rad(20),targets),null);
  assert.equal(snapTarget(rad(18),targets),null);
  assert.equal(snapTarget(rad(17.99),targets),'A');
  const coincident=[target('A',12),target('B',372)];
  assert.equal(snapTarget(rad(12),coincident),null);
  assert.equal(snapTarget(rad(12),coincident,'B'),'B');
});

test('初期方向は最大の隙間の中央となり、可能なら全候補の捕捉範囲から外れる',()=>{
  const targets=[target('A',-60),target('B',0),target('C',60)];
  near(unalignedAngle(targets),Math.PI);
  assert.equal(snapTarget(unalignedAngle(targets),targets),null);
  for(let count=1;count<=8;count++){
    const ring=Array.from({length:count},(_,i)=>target(String(i),i*360/count));
    const initial=unalignedAngle(ring);
    assert(ring.every(t=>angleGap(initial,t.angle)>rad(22)));
    assert.equal(snapTarget(initial,ring),null);
  }
});

test('全周が混雑しても初期方向を候補へ完全一致させず、同率と重複は決定的に扱う',()=>{
  assert.equal(unalignedAngle([]),-Math.PI/4);
  const coincident=[target('B',0),target('A',360)];
  near(unalignedAngle(coincident),Math.PI);
  const ring=Array.from({length:12},(_,i)=>target(String(i),i*30));
  const before=structuredClone(ring),initial=unalignedAngle(ring);
  assert(ring.every(t=>angleGap(initial,t.angle)>rad(14.99)));
  near(unalignedAngle([...ring].reverse()),initial);
  assert.deepEqual(ring,before);
  snapTarget(initial,ring);
  assert.deepEqual(ring,before);
});
