import test from 'node:test';
import assert from 'node:assert/strict';
import {StoryProgress,StoryTransition} from '../src/app/story-progress.js';
import {challenges} from '../src/content/challenges.js';
import {blocks,slides} from '../src/content/story.js';
const ids=challenges.map(c=>c.id);
test('all 42 actual challenge IDs visit the 27 story slides at the approved boundaries',()=>{
 const progress=new StoryProgress(ids),seen=[[1,progress.start(ids[0])]];
 for(let i=1;i<ids.length;i++){const block=progress.advance(ids[i-1],ids[i]);if(block)seen.push([i+1,block]);assert.equal(progress.snapshot().cleared,i);}
 assert.deepEqual(seen,[[1,'P'],[4,'M1'],[6,'M2'],[7,'B1'],[13,'B2'],[19,'B3'],[25,'B4'],[31,'B5'],[37,'B6']]);
 assert.equal(progress.finish(ids.at(-1)),'E');assert.equal(progress.finish(ids.at(-1)),null);assert.equal(progress.snapshot().cleared,42);
 const names=[...seen.map(([,name])=>name),'E'];assert.deepEqual(names,blocks.map(b=>b.id));assert.equal(names.flatMap(name=>slides.filter(s=>s.block===name)).length,27);
});
test('a selected final stage, a skipped stage, or an abandoned journey cannot award the ending',()=>{
 const p=new StoryProgress(ids);assert.equal(p.finish(ids.at(-1)),null);assert.equal(p.start(ids.at(-1)),null);
 p.start(ids[0]);p.advance(ids[0],ids[6]);assert.equal(p.snapshot().active,false);assert.equal(p.finish(ids.at(-1)),null);
 p.start(ids[0]);p.cancel();assert.equal(p.advance(ids[0],ids[1]),null);
});
test('repeated advance notifications do not replay a block or move the journey twice',()=>{
 const p=new StoryProgress(ids);p.start(ids[0]);for(let i=1;i<=3;i++)p.advance(ids[i-1],ids[i]);
 const before=p.snapshot();assert.equal(p.advance(ids[2],ids[3]),null);assert.deepEqual(p.snapshot(),before);
});
test('opening a fresh continuous play resets only its own story progress',()=>{
 const p=new StoryProgress(ids),content=JSON.stringify(challenges);p.start(ids[0]);p.advance(ids[0],ids[1]);assert.equal(p.start(ids[0]),'P');assert.deepEqual(p.snapshot(),{active:true,stage:1,cleared:0,ended:false});assert.equal(JSON.stringify(challenges),content);
});
test('stop, a new request, or an old timer cannot advance the next story',()=>{
 const scheduled=[],cleared=[],calls=[];
 const wait=new StoryTransition({schedule:(fn,delay)=>{scheduled.push({fn,delay});return scheduled.length;},clear:id=>cleared.push(id)});
 wait.wait(1000,()=>calls.push('cancelled'));wait.cancel();scheduled[0].fn();assert.deepEqual(calls,[]);
 wait.wait(800,()=>calls.push('replaced'));wait.wait(500,()=>calls.push('current'));scheduled[1].fn();assert(wait.pending);scheduled[2].fn();assert.deepEqual(calls,['current']);assert(!wait.pending);assert.deepEqual(cleared,[1,2]);
});
