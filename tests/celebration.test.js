import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PerfectCelebration,CELEBRATION_DURATION_MS} from '../src/ui/celebration.js';

function fixture(t){
 const original={document:globalThis.document,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
 const timers=new Map();let token=0;
 class Element {
  constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.properties={};this.style={setProperty:(key,value)=>{this.properties[key]=value;}};}
  setAttribute(key,value){this.attributes[key]=String(value);}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=children;}
  get firstChild(){return this.children[0]??null;}
 }
 globalThis.document={createElementNS:(_ns,tag)=>new Element(tag)};
 globalThis.setTimeout=(callback,delay)=>{const id=++token;timers.set(id,{callback,delay});return id;};
 globalThis.clearTimeout=id=>timers.delete(id);
 t.after(()=>{Object.assign(globalThis,original);});
 const layer=new Element('g'),celebration=new PerfectCelebration(layer,()=>({x:0,y:0,width:1000,height:1500}));
 const run={status:'paused'},result={state:'achieved',score:{numerator:'100',denominator:'1'}};
 return {layer,celebration,run,result,timers};
}

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
