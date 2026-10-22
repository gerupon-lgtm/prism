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
  for(const [id,part]of [['Q11','D'],['Q12','F'],['Q45','D']]){
    const challenge=challenges.find(c=>c.id===id),node=challenge.nodes.find(n=>n.id===part),before=structuredClone(node);
    const view={session:{mode:'challenge',challenge}},original=Board.prototype.position.call({},node);
    const displayed=Board.prototype.position.call(view,node);assert.notEqual(displayed.x,original.x);
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
