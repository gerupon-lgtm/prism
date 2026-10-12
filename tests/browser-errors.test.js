import test from 'node:test';
import assert from 'node:assert/strict';
import { expectedStoppedOriginWorkerError } from '../設計検証/browser_errors.cjs';

const expected={engine:'webkit',originOffline:true,name:'Cannot load http',message:'/127.0.0.1:49924/prism/sw.js due to access control checks.',stack:'',url:'http://127.0.0.1:49924/prism/'};
test('停止した検証配信元のWorker取得エラーだけを予定した通信失敗とする',()=>{
  assert.equal(expectedStoppedOriginWorkerError(expected),true);
});
test('オンライン・他エンジン・実行スタックを持つエラーを除外しない',()=>{
  for(const change of [{originOffline:false},{engine:'chromium'},{stack:'at app.js:1'}])assert.equal(expectedStoppedOriginWorkerError({...expected,...change}),false);
});
test('別資材・別配信元・違うエラー文を除外しない',()=>{
  for(const change of [{message:expected.message.replace('sw.js','app.js')},{message:expected.message.replace('49924','49925')},{name:'TypeError'},{message:'Unexpected failure'}])assert.equal(expectedStoppedOriginWorkerError({...expected,...change}),false);
});
test('公開URL・異なる検証パス・不正URLをこの判定へ流用しない',()=>{
  for(const url of ['https://example.com/prism/','http://127.0.0.1:49924/other/','invalid'])assert.equal(expectedStoppedOriginWorkerError({...expected,url}),false);
});
