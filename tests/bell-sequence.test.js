import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/core/simulation.js';
import {bellSequenceResult,validateBellSequence} from '../src/core/bell-sequence.js';
const challenge={goals:['G1','G2','G3'],intervals:['0.5','1'],intervalTolerance:'0.1'};
function run(times=['0.5','1','2']){
 const s=new Simulation({mode:'spread',target:'all',nodes:[{id:'S',kind:'source',process:'0.5'},{id:'A',kind:'prism',process:'0.5'},...['G1','G2','G3'].map(id=>({id,kind:'goal',process:'0'}))],edges:[{id:'SA',from:'S',to:'A',time:'0.5'},...times.map((time,i)=>({id:'AG'+(i+1),from:'A',to:'G'+(i+1),time}))]});while(!s.exhausted)s.advanceNext();return s;
}
test('各鐘の初回到達から指定順と間隔を判定し、最後の鐘の時刻を採点へ返す',()=>{
 const s=run(),before=JSON.stringify(s.records),r=bellSequenceResult(challenge,s);assert.equal(r.state,'achieved');assert.equal(r.actual,'3');assert.deepEqual(r.gaps,['0.5','1']);assert.equal(JSON.stringify(s.records),before);
});
test('描画やイベントの並びで同時到達を指定順へ変換しない。逆順も失敗する',()=>{
 assert.equal(bellSequenceResult(challenge,run(['0.5','0.5','2'])).state,'failed');assert.equal(bellSequenceResult(challenge,run(['1','0.5','2'])).state,'failed');
});
test('新セットの間隔だけ0.1秒の幅を認め、境界を越えたら失敗する',()=>{
 assert.equal(bellSequenceResult(challenge,run(['0.5','1.1','2.1'])).state,'achieved');assert.equal(bellSequenceResult(challenge,run(['0.5','1.11','2.11'])).state,'failed');assert.equal(bellSequenceResult({...challenge,intervalTolerance:'0'},run(['0.5','1.1','2.1'])).state,'failed');
});
test('順番だけの課題へ間隔を追加せず、未到達・途中停止・到達待ちを区別する',()=>{
 const s=run(['0.5','1.2','4']);assert.equal(bellSequenceResult({goals:challenge.goals},s).state,'achieved');const s2=run();s2.records=s2.records.filter(r=>r.node!=='G3');assert.equal(bellSequenceResult(challenge,s2).state,'failed');s2.status='stopped';assert.equal(bellSequenceResult(challenge,s2).state,'stopped');
 const pending=new Simulation(s.circuit.raw);pending.advanceUntil('0.5');assert.equal(bellSequenceResult(challenge,pending).state,'pending');
});
test('指定順を配列の重複・不在の鐘や間隔数の不一致から保護する',()=>{
 const s=run(),scale=s.circuit.time,goals=s.circuit.goals;assert.throws(()=>validateBellSequence({goals:['G1','G1']},scale,goals));assert.throws(()=>validateBellSequence({goals:['G1','bad']},scale,goals));assert.throws(()=>validateBellSequence({...challenge,intervals:['1']},scale,goals));assert.throws(()=>validateBellSequence({...challenge,intervalTolerance:'-0.1'},scale,goals));
});
test('初回より後の追加到達は順番と間隔の結果を変えず、記録は残る',()=>{
 const s=run(),before=bellSequenceResult(challenge,s);s.records.push({...s.arrivals('G1')[0],time:'4'});assert.deepEqual(bellSequenceResult(challenge,s),before);assert.equal(s.arrivals('G1').length,2);
});
