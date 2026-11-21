import test from 'node:test';
import assert from 'node:assert/strict';
import {KeepAwake} from '../src/ui/keep-awake.js';
function lock(){const l=new EventTarget();l.releases=0;l.release=async()=>{l.releases++;l.dispatchEvent(new Event('release'));};return l;}
test('再生中の要求を重複させず、停止すると画面保持を解放する',async()=>{
 const held=lock();let calls=0;const awake=new KeepAwake({request:async kind=>{assert.equal(kind,'screen');calls++;return held;}});
 await Promise.all([awake.start(),awake.start()]);assert.equal(calls,1);assert.equal(awake.inspect().held,true);awake.stop();assert.equal(held.releases,1);assert.equal(awake.inspect().held,false);
});
test('停止後に届いた画面保持はその場で解放し、新しい再生の保持を消さない',async()=>{
 const resolve=[],awake=new KeepAwake({request:()=>new Promise(r=>resolve.push(r))});const old=awake.start();awake.stop();const current=awake.start(),first=lock(),second=lock();resolve[1](second);await current;resolve[0](first);await old;
 assert.equal(first.releases,1);assert.equal(second.releases,0);assert.equal(awake.inspect().held,true);awake.stop();assert.equal(second.releases,1);
});
test('OSによる解放と再生の停止が重なっても新しい保持を解放しない',async()=>{
 const first=lock(),second=lock(),queue=[first,second],awake=new KeepAwake({request:async()=>queue.shift()});await awake.start();await first.release();assert.equal(awake.inspect().held,false);await awake.start();first.dispatchEvent(new Event('release'));assert.equal(awake.inspect().held,true);awake.stop();assert.equal(second.releases,1);
});
test('非対応と要求拒否では例外を再生側へ渡さず、後の要求は再試行できる',async()=>{
 const unsupported=new KeepAwake(null);await unsupported.start();assert.equal(unsupported.inspect().supported,false);
 const held=lock();let calls=0;const awake=new KeepAwake({request:async()=>{if(++calls===1)throw new DOMException('denied','NotAllowedError');return held;}});await awake.start();assert.equal(awake.inspect().error,'NotAllowedError');await awake.start();assert.equal(awake.inspect().held,true);awake.stop();
});
