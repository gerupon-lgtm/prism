import test from 'node:test';
import assert from 'node:assert/strict';
import { TouchConfirm } from '../src/ui/touch-confirm.js';

function fixture(){
  const handlers=new Map(),doc={addEventListener(type,fn){const list=handlers.get(type)??[];list.push(fn);handlers.set(type,list);}};
  let context={},calls=0,unlocks=0;
  const root={ownerDocument:doc,open:true,contains:element=>element===button};
  const button={disabled:false,getBoundingClientRect:()=>({left:0,top:0,right:200,bottom:60}),closest:()=>button,click(){const event=send('click',{detail:0});if(!event.stopped)calls++;}};
  const controls=new TouchConfirm(root,{context:()=>context,beforeActivate:()=>unlocks++});
  function send(type,extra={}){const event={type,target:button,pointerType:'touch',pointerId:1,button:0,isPrimary:true,clientX:100,clientY:30,detail:0,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra};for(const fn of handlers.get(type)??[]){fn(event);if(event.stopped)break;}return event;}
  return {root,button,controls,send,context:value=>context=value,calls:()=>calls,unlocks:()=>unlocks};
}
test('指がずれて通常クリックが来なくても、新しく押したボタン内で離せば1回だけ確定する',()=>{
  const f=fixture();f.send('pointerdown');f.send('pointerup',{clientX:116,clientY:46});assert.equal(f.calls(),1);assert.equal(f.unlocks(),1);
  const native=f.send('click',{detail:1,pointerId:9,pointerType:'mouse'});assert.equal(native.stopped,true);assert.equal(f.calls(),1,'Retargeted compatibility click is also consumed');
  f.send('pointerdown',{pointerId:2});f.send('pointerup',{pointerId:2});assert.equal(f.calls(),2,'Fresh input is never swallowed by the preceding release');
});
test('元の長押しの指を離すだけ、ボタン外、取消、2本指は確定しない',()=>{
  for(const mode of ['original','outside','cancel','multitouch','closed','changed','disabled']){
    const f=fixture();
    f.send('pointerdown',mode==='original'?{target:{closest:()=>null}}:{});
    if(mode==='cancel')f.send('pointercancel');
    if(mode==='multitouch')f.send('pointerdown',{pointerId:2});
    if(mode==='closed')f.root.open=false;
    if(mode==='changed')f.context({});
    if(mode==='disabled')f.button.disabled=true;
    f.send('pointerup',mode==='outside'?{clientX:220}:{});assert.equal(f.calls(),0,mode);
  }
});
test('取消後に残った指情報を消し、次のタップを受け付ける。マウスとキーボードのクリックを妨げない',()=>{
  const f=fixture();f.send('pointerdown');f.controls.reset();f.send('pointerdown',{pointerId:2});f.send('pointerup',{pointerId:2});assert.equal(f.calls(),1);
  assert.equal(f.send('click',{detail:0}).stopped,undefined);
  f.send('pointerdown',{pointerType:'mouse',pointerId:3});assert.equal(f.send('click',{pointerType:'mouse',pointerId:3,detail:1}).stopped,undefined);
});
