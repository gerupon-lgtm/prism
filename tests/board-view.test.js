import test from 'node:test';
import assert from 'node:assert/strict';
import { Board } from '../src/ui/board.js';
import { challenges } from '../src/content/challenges.js';
import { frameRotation } from '../src/ui/orientation.js';

function hitBoard(){
  const points=[['S',0,100],['A',100,100],['B',145,100],['G',100,0]];
  return {world:{querySelectorAll:()=>points.map(([id,x,y])=>({dataset:{node:id},querySelector:()=>({getBoundingClientRect:()=>({left:x-22,top:y-22,width:44,height:44})})}))},session:{circuit:{nodes:points.map(([id])=>({id,kind:id==='G'?'goal':'prism'}))},planConnections:route=>{if(route.at(-1)==='B')throw Error('Not an available candidate');}}};
}

test('課題の直通線は途中のパーツの中心と重ならず、別経路として見分けられる',()=>{
  const overlaps=[];
  for(const challenge of challenges){
    const board={session:{mode:'challenge',challenge},projectionScale:1},positions=new Map(challenge.nodes.map(node=>[node.id,Board.prototype.position.call(board,node)]));
    for(const edge of challenge.candidates){
      const a=positions.get(edge.from),b=positions.get(edge.to),dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;if(!length)continue;
      for(const [id,p]of positions){
        if([edge.from,edge.to].includes(id))continue;
        const t=((p.x-a.x)*dx+(p.y-a.y)*dy)/length;
        if(t>0&&t<1&&Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t)<1e-7)overlaps.push(`Q${challenge.number} ${edge.id} through ${id}`);
      }
    }
  }
  assert.deepEqual(overlaps,[]);
});

test('重なる課題の表示位置だけを調整し、元の座標と自由作成の配置は保持する',()=>{
  for(const [id,part]of challenges.flatMap(c=>Object.keys(c.displayPositions??{}).map(part=>[c.id,part]))){
    const challenge=challenges.find(c=>c.id===id),node=challenge.nodes.find(n=>n.id===part),before=structuredClone(node);
    const view={session:{mode:'challenge',challenge}},original=Board.prototype.position.call({},node);
    const displayed=Board.prototype.position.call(view,node);assert.notDeepEqual(displayed,original);
    view.session.run={status:'running'};assert.deepEqual(Board.prototype.position.call(view,node),displayed);
    view.session.mode='free';assert.deepEqual(Board.prototype.position.call(view,node),original);assert.deepEqual(node,before);
  }
});

test('候補が重なっていても近い結線済みの線を選び、線から離れた場所は選ばない',()=>{
  const board={onCurve:Board.prototype.onCurve,session:{circuit:{edges:[{id:'built'}]}},world:{getScreenCTM:()=>({a:1,b:0,c:0,d:1,e:0,f:0})},curves:new Map([['built',{a:{x:0,y:0},b:{x:100,y:100},control:{x:50,y:50}}]])};
  assert.equal(Board.prototype.edgeTarget.call(board,50,53),'built');
  assert.equal(Board.prototype.edgeTarget.call(board,50,80),null);
});

test('結線は点の手前や横で離しても受け付け、遠い余白では次の対象を選ばない',()=>{
  const board=hitBoard(),target=(x,y,options)=>Board.prototype.wireTarget.call(board,x,y,options);
  assert.equal(target(29,100),'S');assert.equal(target(100,119,{route:['S']}),'A');
  assert.equal(target(131,100,{route:['S'],final:true}),'A');
  assert.equal(target(105,145,{route:['S'],final:true}),null);
});

test('連続結線の通過は操作範囲に余白を加え、拡大したパーツも同じ見た目の範囲で受け付ける',()=>{
  const board=hitBoard();
  assert.equal(Board.prototype.wireTarget.call(board,100,125,{route:['S']}),'A');
  const query=board.world.querySelectorAll;
  board.world.querySelectorAll=()=>query().map(group=>({...group,querySelector:()=>({getBoundingClientRect:()=>{const old=group.querySelector().getBoundingClientRect();return {left:old.left-28,top:old.top-28,width:100,height:100};}})}));
  assert.equal(Board.prototype.wireTarget.call(board,100,149,{route:['S']}),'A');
});

test('最後を外して離しても受け付け済み区間を確定し、未到達なら線を増やさない',()=>{
  for(const route of [['S','A'],['S','A','G'],['S']]){
    const connected=[],board={gesture:{kind:'wire',moved:true,route,releaseTarget:null},pointers:new Map([[1,{}]]),magnifier:{hide(){}},stopHold(){},move(){},setWirePreview(){},session:{editable:true,connectPath:path=>connected.push([...path])},render(){},changed(){},notify:error=>assert.fail(error)};
    Board.prototype.up.call(board,{pointerId:1});
    assert.deepEqual(connected,route.length>1?[route]:[]);assert.equal(board.gesture,null);
  }
});

test('近接候補では接続できる近い点を選び、近い候補外の点へは結線しない',()=>{
  const board=hitBoard(),target=(x,y)=>Board.prototype.wireTarget.call(board,x,y,{route:['S'],final:true});
  assert.equal(target(126,100),'A');assert.equal(target(145,100),null);
  board.session.planConnections=()=>{};assert.equal(target(126,100),'B');
});

test('鐘で終わった連続結線は近傍へずれても確定でき、鐘の先へ追加しない',()=>{
  const board=hitBoard(),target=(x,y)=>Board.prototype.wireTarget.call(board,x,y,{route:['S','A','G'],final:true});
  assert.equal(target(130,0),'G');assert.equal(target(100,100),null);
});

test('記録画面などで盤面の表示行列がない間は秒数配置を保留する',()=>{
  assert.doesNotThrow(()=>Board.prototype.fitTimeLabels.call({world:{getScreenCTM:()=>null}}));
});

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
  assert.deepEqual(Board.prototype.coordinates.call(view,{x:125,y:880}),{x:.25,y:.45});
});

test('大きい保存座標の表示と逆変換も同じ倍率を保つ',()=>{
  const view={projectionScale:10000},node={x:2500,y:7500};
  const at=Board.prototype.position.call(view,node);assert.deepEqual(at,{x:125,y:400});
  assert.deepEqual(Board.prototype.coordinates.call(view,at),node);
});

test('空き幅に合わせて横方向を広げても保存座標と点の形の基準を保つ',()=>{
  const view={projectionScale:1,displayWidthRatio:2};
  const left=Board.prototype.position.call(view,{x:.25,y:.45}),right=Board.prototype.position.call(view,{x:.75,y:.45});
  assert.equal(right.x-left.x,1500);assert.deepEqual(Board.prototype.coordinates.call(view,left),{x:.25,y:.45});
});

test('スマホの下側の余白を盤面に戻しても追加・移動の座標は往復で保存値を保つ',()=>{
  for(const projectionHeight of [1280,1600,1740])for(const projectionScale of [1,10000]){
    const view={projectionHeight,projectionScale,displayWidthRatio:1.8};
    for(const [x,y]of [[.5,.1],[.02,.97],[1.2,-.2]]){
      const node={x:x*projectionScale,y:y*projectionScale},before={...node};
      const restored=Board.prototype.coordinates.call(view,Board.prototype.position.call(view,node));
      assert(Math.abs(restored.x-node.x)<1e-9);assert(Math.abs(restored.y-node.y)<1e-9);assert.deepEqual(node,before);
    }
  }
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
  assert.equal(frameRotation({width:844,height:390}),0);
  assert.equal(frameRotation({width:1740,height:1044,coarse:false,type:'landscape-primary',angle:90}),0);
  assert.equal(frameRotation({width:1280,height:800,coarse:false,editing:true,previous:-90}),0);
  assert.equal(frameRotation({width:844,height:390,coarse:true}),-90);
});

test('横向きの情報と記憶した縦基準が食い違っても0度・180度へ回さない',()=>{
  const input={coarse:true,width:915,height:330,portraitAngle:90};
  assert.equal(frameRotation({...input,type:'landscape-primary',angle:90}),-90);
  assert.equal(frameRotation({...input,type:'landscape-secondary',angle:270}),90);
});

test('Q17のAからFへの直線はCの操作範囲と余裕を保ち、途中の接続と混同しない',()=>{
  const challenge=challenges.find(c=>c.number===17);
  const view={session:{mode:'challenge',challenge},projectionHeight:1740,displayWidthRatio:1.1};
  const at=id=>Board.prototype.position.call(view,challenge.nodes.find(n=>n.id===id));
  const a=at('A'),b=at('F'),p=at('C'),dx=b.x-a.x,dy=b.y-a.y;
  const t=((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy);
  assert(t>0&&t<1);
  // 130 view units are the normal part's touch radius at the phone projection.
  assert(Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t)>150,'A-F must clear C, including a margin');
});

test('往復する光は方向別の直線で分かれ、確定順や縮尺で入れ替わらない',()=>{
  const edges=[{id:'SC',from:'S',to:'C'},{id:'CS',from:'C',to:'S'}];
  const a={x:0,y:0},b={x:100,y:200};
  for(const scale of [.2,.5,1]){
    const board={};
    const out=Board.prototype.edgeCurve.call(board,a,b,edges[0],edges,scale);
    const back=Board.prototype.edgeCurve.call(board,b,a,edges[1],[...edges].reverse(),scale);
    for(const curve of [out,back]){
      assert.deepEqual(curve.control,{x:(curve.a.x+curve.b.x)/2,y:(curve.a.y+curve.b.y)/2});
      assert(Math.hypot(curve.a.x-(curve===out?a:b).x,curve.a.y-(curve===out?a:b).y)*scale<=4.001);
    }
    assert(Math.abs(Math.hypot(out.a.x-back.b.x,out.a.y-back.b.y)*scale-8)<1e-9);
    assert.deepEqual(out,Board.prototype.edgeCurve.call(board,a,b,edges[0],[...edges].reverse(),scale));
    assert.deepEqual(a,{x:0,y:0});assert.deepEqual(b,{x:100,y:200});
  }
  assert.deepEqual(Board.prototype.edgeCurve.call({},a,b,edges[0],[edges[0]],1),{a,b,control:{x:50,y:100}});
});

test('全42面の左右の均衡と直線経路の操作余白を保つ',()=>{
 for(const c of challenges){
  const view={session:{mode:'challenge',challenge:c},projectionHeight:1740,displayWidthRatio:1.1};
  const points=c.nodes.map(n=>({id:n.id,kind:n.kind,...Board.prototype.position.call(view,n)}));
  const middle=points.find(n=>n.kind==='source').x;
  const mirror=new Map(points.map(n=>[n.id,points.find(m=>m.kind===n.kind&&Math.abs(m.x+n.x-middle*2)<1e-7&&Math.abs(m.y-n.y)<1e-7)?.id]));
  assert([...mirror.values()].every(Boolean),c.id+' reflected parts');
  if(c.number>6)for(const e of c.candidates)assert(c.candidates.some(f=>(f.from===mirror.get(e.from)&&f.to===mirror.get(e.to))||(f.to===mirror.get(e.from)&&f.from===mirror.get(e.to))),c.id+' reflected route '+e.id);
  for(const e of c.candidates){
   const a=points.find(n=>n.id===e.from),b=points.find(n=>n.id===e.to),dx=b.x-a.x,dy=b.y-a.y;
   for(const n of points.filter(n=>n.id!==a.id&&n.id!==b.id)){
    const t=Math.max(0,Math.min(1,((n.x-a.x)*dx+(n.y-a.y)*dy)/(dx*dx+dy*dy)));
    assert(Math.hypot(n.x-a.x-t*dx,n.y-a.y-t*dy)>=160,c.id+' '+e.id+' clears '+n.id);
   }
  }
 }
});

test('全鐘到達セットの最終面は一度の分岐だけでは三つの鐘へ届かない',()=>{
 const c=challenges.find(c=>c.number===12);
 assert.equal(c.goals.length,3);
 assert.deepEqual(c.candidates.filter(e=>e.from==='S').map(e=>e.id),['SA']);
 assert.deepEqual([...new Set(c.candidates.filter(e=>c.goals.includes(e.to)).map(e=>e.from))].sort(),['D','E']);
 for(const id of ['D','E']){const out=c.candidates.filter(e=>e.from===id);assert.equal(out.length,2);assert(out.every(e=>c.goals.includes(e.to)));}
 assert.equal(c.candidates.length,13);
});
