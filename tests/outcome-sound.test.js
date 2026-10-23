import test from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '../src/app/session.js';
import { LocalRecords } from '../src/core/storage.js';
import { OutcomeSound } from '../src/ui/outcome-sound.js';

function fixture(){
  const data=new Map(),calls=[];
  const session=new Session(new LocalRecords({getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)}));
  const sound=new OutcomeSound({clear:()=>calls.push('clear'),perfect:()=>calls.push('perfect'),failure:()=>calls.push('failure')});
  return {session,sound,calls};
}
function complete(s,id,path){s.replace({challengeId:id});s.connectPath(path);s.start();s.advance('10');}

test('実際の満点と部分点の結果で音を分け、再表示では重ねない',()=>{
  const {session:s,sound,calls}=fixture();complete(s,'Q1',['S','A','G']);
  const before=s.exportResult();sound.update(s.run,s.result,true);sound.update(s.run,s.result,true);
  assert.deepEqual(calls,['perfect']);assert.deepEqual(s.exportResult(),before);
  s.stop();complete(s,'Q2',['S','C','G']);sound.update(s.run,s.result,true);sound.update(s.run,s.result,true);
  assert.deepEqual(calls,['perfect','clear']);
});

test('小数の部分点を満点と扱わず、通常クリアの音を使う',()=>{
  const {session:s,sound,calls}=fixture();complete(s,'Q1',['S','A','G']);
  sound.update(s.run,{...s.result,score:{numerator:'999999',denominator:'10000'}},true);
  assert.deepEqual(calls,['clear']);
});

test('未達成が判明しても光が動いている間は待ち、終了時に一度だけ鳴らす',()=>{
  const {session:s,sound,calls}=fixture();s.replace({challengeId:'Q7'});s.connectPath(['S','A','B','D','G1']);s.start();
  assert.equal(s.result.state,'failed');assert(!s.run.exhausted);sound.update(s.run,s.result,true);assert.deepEqual(calls,[]);
  s.advance('10');assert(s.run.exhausted);const before=s.exportResult();sound.update(s.run,s.result,true);sound.update(s.run,s.result,true);
  assert.deepEqual(calls,['failure']);assert.deepEqual(s.exportResult(),before);
});

test('途中停止と確定前には鳴らさず、隠れた結果や負荷停止の音を後から鳴らさない',()=>{
  const {session:s,sound,calls}=fixture();s.connectPath(['S','A','G']);s.start();s.advance('0.5');sound.update(s.run,s.result,true);s.stop();sound.update(s.run,s.result,true);assert.deepEqual(calls,[]);
  complete(s,'Q1',['S','A','G']);sound.update(s.run,s.result,false);sound.update(s.run,s.result,true);assert.deepEqual(calls,[]);
  s.stop();complete(s,'Q1',['S','A','G']);s.run.pause('load');sound.update(s.run,s.result,true);s.run.pauseReason=null;sound.update(s.run,s.result,true);assert.deepEqual(calls,[]);
});

test('時間切れは完了待機中に未達成音を一度だけ鳴らし、編集復帰で繰り返さない',()=>{
  const {session:s,sound,calls}=fixture();s.connectPath(['S','A','G']);s.challenge={...s.challenge,maxDuration:'1'};
  s.start();s.advance('10');assert(s.run.exhausted);assert.equal(s.result.state,'stopped');
  sound.update(s.run,s.result,true);sound.update(s.run,s.result,true);assert.deepEqual(calls,['failure']);
  s.stop();sound.update(s.run,s.result,true);assert.deepEqual(calls,['failure']);
});
