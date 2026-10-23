import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PerfectCelebration,CELEBRATION_DURATION_MS} from '../src/ui/celebration.js';

function fixture(t,{animations}={}){
 const original={document:globalThis.document,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
 const timers=new Map(),frames=new Map();let token=0;
 class Element {
  constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.properties={};this.style={setProperty:(key,value)=>{this.properties[key]=value;}};if(animations!==undefined)this.getAnimations=options=>{assert.deepEqual(options,{subtree:true});return typeof animations==='function'?animations():animations;};}
  setAttribute(key,value){this.attributes[key]=String(value);}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=children;}
  get firstChild(){return this.children[0]??null;}
 }
 globalThis.document={createElementNS:(_ns,tag)=>new Element(tag)};
 globalThis.setTimeout=(callback,delay)=>{const id=++token;timers.set(id,{callback,delay});return id;};
 globalThis.clearTimeout=id=>timers.delete(id);
 globalThis.requestAnimationFrame=callback=>{const id=++token;frames.set(id,callback);return id;};
 globalThis.cancelAnimationFrame=id=>frames.delete(id);
 t.after(()=>{Object.assign(globalThis,original);});
 const layer=new Element('g'),celebration=new PerfectCelebration(layer,()=>({x:0,y:0,width:1000,height:1500}));
 const run={status:'paused'},result={state:'achieved',score:{numerator:'100',denominator:'1'}};
 const fireTimer=delay=>{const [id,timer]=[...timers].find(([,timer])=>timer.delay===delay)??[];assert(timer,'pending timer '+delay);timers.delete(id);timer.callback();};
 const paint=()=>{const [id,callback]=frames.entries().next().value??[];assert(callback,'pending animation frame');frames.delete(id);callback(0);};
 return {layer,celebration,run,result,timers,frames,fireTimer,paint,setAnimations:value=>{animations=value;}};
}

function animation(){
 let finish,cancel;const finished=new Promise((resolve,reject)=>{finish=resolve;cancel=reject;});
 return {finished,finish,cancel};
}
async function flushAnimations(){await Promise.resolve();await Promise.resolve();}

test('五つの花火を全て結果表示前に咲かせ、1.5秒で片付ける',t=>{
 const {layer,celebration,run,result,timers}=fixture(t);celebration.update(run,result,true);
 assert.equal(layer.children.length,1);const bursts=layer.firstChild.children;assert.equal(bursts.length,5);
 const css=readFileSync(new URL('../src/ui/app.css',import.meta.url),'utf8');let latest=0;
 for(const burst of bursts){
  const delay=Number.parseFloat(burst.properties['--firework-delay']);
  assert.equal(burst.children[1].children.filter(child=>child.tag==='circle').length,24);
  for(const kind of ['rocket','ray','star']){
   const declaration=css.match(new RegExp('\\.firework-'+kind+'\\{([^}]+)\\}'))?.[1];assert(declaration);
   const duration=Number(declaration.match(/animation:firework-[a-z]+ ([\d.]+)ms/)?.[1]);
   const offset=Number(declaration.match(/animation-delay:calc\(var\(--firework-delay\) \+ ([\d.]+)ms\)/)?.[1]??0);
   assert(Number.isFinite(duration)&&duration>0);latest=Math.max(latest,delay+offset+duration);
  }
 }
 assert(latest<=1500);assert.equal(CELEBRATION_DURATION_MS,1500);assert(latest<CELEBRATION_DURATION_MS);
 const timer=[...timers.values()][0];assert.equal(timer.delay,1500);timer.callback();assert.equal(layer.children.length,0);
 celebration.update(run,result,true);assert.equal(layer.children.length,0);
});

test('停止と画面移動は花火を消し、次の実行で前の花火を残さない',t=>{
 const {layer,celebration,run,result,timers}=fixture(t);celebration.update(run,result,true);
 run.status='stopped';celebration.update(run,result,true);assert.equal(layer.children.length,0);assert.equal(timers.size,0);
 const next={status:'paused'};celebration.update(next,result,true);assert.equal(layer.children.length,1);
 celebration.update(next,result,false);assert.equal(layer.children.length,0);assert.equal(timers.size,0);
 celebration.update({status:'paused'},result,true);assert.equal(layer.children.length,1);celebration.cancel();assert.equal(layer.children.length,0);
});

test('CSS開始が遅れて1500msで最後の花火が未完了でも、全245個が終わるまで片付けない',async t=>{
 const animations=Array.from({length:245},animation);
 const {layer,celebration,run,result,paint,fireTimer,timers,frames}=fixture(t,{animations});
 celebration.update(run,result,true);paint();
 fireTimer(1500);assert.equal(layer.children.length,1,'insertion timer cannot cut a still-running final burst');
 animations.slice(0,-1).forEach(effect=>effect.finish());await flushAnimations();
 assert.equal(layer.children.length,1,'the final ray or star must also finish');
 animations.at(-1).finish();await flushAnimations();
 assert.equal(layer.children.length,1,'finished Promise must not remove the root before animationend dispatch');
 assert.equal(frames.size,1);paint();
 assert.equal(layer.children.length,0);assert.equal(timers.size,0);
 celebration.update(run,result,true);assert.equal(layer.children.length,0,'rerender does not replay a finished run');
});

test('CSSが早く完了しても従来の1500msは保ち、控えめな演出や未対応APIも1500msで片付ける',async t=>{
 const effect=animation(),f=fixture(t,{animations:[effect]});
 f.celebration.update(f.run,f.result,true);f.paint();effect.finish();await flushAnimations();
 assert.equal(f.layer.children.length,1);assert.equal(f.timers.size,1);
 f.fireTimer(1500);assert.equal(f.layer.children.length,0);
 for(const animations of [[],[{}],()=>{throw new Error('unavailable');}]){
  const next={status:'paused'};f.setAnimations(animations);f.celebration.update(next,f.result,true);f.paint();
  assert.equal(f.timers.size,1);f.fireTimer(1500);assert.equal(f.layer.children.length,0);
 }
});

test('CSS完了の通知が来ない場合や最初の描画待ちも3000msで打ち切る',t=>{
 const {layer,celebration,run,result,paint,fireTimer,timers,frames}=fixture(t,{animations:[animation()]});
 celebration.update(run,result,true);paint();fireTimer(1500);assert.equal(layer.children.length,1);
 fireTimer(3000);assert.equal(layer.children.length,0);assert.equal(timers.size,0);
 celebration.update({status:'paused'},result,true);assert.equal(frames.size,1);
 fireTimer(1500);assert.equal(layer.children.length,1);fireTimer(3000);
 assert.equal(layer.children.length,0);assert.equal(frames.size,0);assert.equal(timers.size,0);
});

test('遅いCSS完了後の描画待ちも3000ms以内で片付け、古い片付けフレームを次へ渡さない',async t=>{
 const old=animation(),next=animation(),f=fixture(t,{animations:[old]});
 f.celebration.update(f.run,f.result,true);f.paint();f.fireTimer(1500);old.finish();await flushAnimations();
 assert.equal(f.layer.children.length,1);assert.equal(f.frames.size,1);
 assert([...f.timers.values()].some(timer=>timer.delay===3000),'safety limit remains armed for a missing final frame');
 const oldCleanup=[...f.frames.values()][0];f.fireTimer(3000);
 assert.equal(f.layer.children.length,0);assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);
 f.setAnimations([next]);f.celebration.update({status:'paused'},f.result,true);const current=f.layer.firstChild;
 oldCleanup();assert.equal(f.layer.firstChild,current);assert.equal(f.frames.size,1);
 f.paint();f.fireTimer(1500);next.finish();await flushAnimations();f.paint();
 assert.equal(f.layer.children.length,0);assert.equal(f.timers.size,0);
});

test('APIが途中までしか完了Promiseを返さなくても、取得済みPromiseの取消を必ず処理する',async t=>{
 const f=fixture(t,{animations:[]});
 for(const unsupported of [{},{get finished(){throw new Error('incomplete API');}}]){
  const effect=animation();f.setAnimations([effect,unsupported]);
  f.celebration.update({status:'paused'},f.result,true);f.paint();
  effect.cancel(new Error('CSS cancelled after fallback'));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.layer.children.length,1);assert.equal(f.timers.size,1);
  f.fireTimer(1500);assert.equal(f.layer.children.length,0);
 }
});

test('取消でfinishedが拒否されても処理し、古いタイマー・描画・完了通知で次の花火を消さない',async t=>{
 const old=animation(),next=animation();
 const {layer,celebration,run,result,paint,fireTimer,timers,frames,setAnimations}=fixture(t,{animations:[old]});
 celebration.update(run,result,true);
 const oldFrame=[...frames.values()][0],oldTimers=[...timers.values()].map(timer=>timer.callback);
 paint();celebration.cancel();assert.equal(timers.size,0);assert.equal(frames.size,0);
 setAnimations([next]);const nextRun={status:'paused'};celebration.update(nextRun,result,true);paint();
 const current=layer.firstChild;
 oldFrame();oldTimers.forEach(callback=>callback());old.cancel(new Error('manual cancellation'));await flushAnimations();
 assert.equal(layer.firstChild,current);assert.equal(celebration.run,nextRun);
 fireTimer(1500);assert.equal(layer.firstChild,current);
 next.finish();await flushAnimations();assert.equal(layer.firstChild,current);paint();assert.equal(layer.children.length,0);assert.equal(timers.size,0);
});

test('実際のCSS待ちの間も停止・非表示で直ちに取り消し、同じ実行では再生しない',async t=>{
 const effect=animation(),{layer,celebration,run,result,paint,fireTimer,timers,frames}=fixture(t,{animations:[effect]});
 celebration.update(run,result,true);paint();fireTimer(1500);assert.equal(layer.children.length,1);
 celebration.update(run,result,false);assert.equal(layer.children.length,0);assert.equal(timers.size,0);assert.equal(frames.size,0);
 effect.cancel(new Error('hidden'));await flushAnimations();celebration.update(run,result,true);assert.equal(layer.children.length,0);
 const stopped={status:'paused'};celebration.update(stopped,result,true);stopped.status='stopped';celebration.update(stopped,result,true);
 assert.equal(layer.children.length,0);assert.equal(timers.size,0);assert.equal(frames.size,0);
});

test('結果カードへの自然復帰では始まっている花火だけをCSS完了まで保ち、停止後に新しく始めない',async t=>{
 const effect=animation(),{layer,celebration,run,result,paint,fireTimer,timers}=fixture(t,{animations:[effect]});
 celebration.update(run,result,true);paint();fireTimer(1500);const current=layer.firstChild;
 run.status='stopped';celebration.update(run,result,true,{naturalEnding:true});
 assert.equal(layer.firstChild,current,'automatic card display cannot cut the final burst');
 effect.finish();await flushAnimations();assert.equal(layer.firstChild,current);paint();assert.equal(layer.children.length,0);assert.equal(timers.size,0);
 celebration.update(run,result,true,{naturalEnding:true});assert.equal(layer.children.length,0);
 celebration.update({status:'stopped'},result,true,{naturalEnding:true});assert.equal(layer.children.length,0,'stopped run cannot start new fireworks');
});

test('自然終了を待つ花火も手動停止・非表示・別実行で取り消す',t=>{
 const f=fixture(t,{animations:[animation()]});
 for(const action of ['manual','hidden','new-run']){
  const run={status:'paused'};f.celebration.update(run,f.result,true);f.paint();f.fireTimer(1500);
  run.status='stopped';f.celebration.update(run,f.result,true,{naturalEnding:true});assert.equal(f.layer.children.length,1);
  if(action==='manual')f.celebration.update(run,f.result,true);
  else if(action==='hidden')f.celebration.update(run,f.result,false,{naturalEnding:true});
  else f.celebration.update({status:'stopped'},f.result,true,{naturalEnding:true});
  assert.equal(f.layer.children.length,0,action);assert.equal(f.timers.size,0);assert.equal(f.frames.size,0);
 }
});
