import test from 'node:test';
import assert from 'node:assert/strict';
import { waitForAsync } from '../設計検証/browser_wait.cjs';

test('ブラウザ準備の非同期結果がfalseなら完了とせず、trueまで確認する',async()=>{
  let checks=0,waits=0;
  const page={evaluate:async()=>Promise.resolve(++checks>=3),waitForTimeout:async()=>{waits++;}};
  assert.equal(await waitForAsync(page,()=>{},null),true);
  assert.equal(checks,3);assert.equal(waits,2);
});

test('ブラウザ準備が非同期でfalseを返し続けたら、期限切れで不合格にする',async()=>{
  const page={evaluate:async()=>Promise.resolve(false),waitForTimeout:async()=>{throw new Error('Should expire before waiting');}};
  await assert.rejects(waitForAsync(page,()=>{},null,{timeout:0}),/did not become ready/);
});

test('準備のPromise自体が解決しない場合も、待機期限で不合格にする',async()=>{
  const page={evaluate:()=>new Promise(()=>{}),waitForTimeout:async()=>{}};
  await assert.rejects(waitForAsync(page,()=>{},null,{timeout:15}),/did not become ready/);
});

test('評価中に期限を超えてtrueとなっても、遅い完了を合格としない',async()=>{
  const page={evaluate:async()=>{const until=performance.now()+15;while(performance.now()<until){/* Synthetic blocking evaluation. */}return true;},waitForTimeout:async()=>{}};
  await assert.rejects(waitForAsync(page,()=>{},null,{timeout:1}),/did not become ready/);
});
