import test from 'node:test';
import assert from 'node:assert/strict';
import {Session} from '../src/app/session.js';
import {LocalRecords} from '../src/core/storage.js';
import {tutorialContent} from '../src/ui/tutorial-content.js';

const session=()=>new Session(new LocalRecords({getItem:()=>null,setItem:()=>{}}));
const run=(s,time)=>{s.start();s.advance(time);s.stop();};

test('操作のお手本は今つなぐ区間へ進み、実行中は見守る案内へ変わる',()=>{
  const s=session();s.beginGuide();assert.deepEqual(tutorialContent(s,true).demo,{from:'S',to:'A',kind:'drag'});
  s.connect('S','A');assert.deepEqual(tutorialContent(s).demo,{from:'A',to:'G',kind:'drag'});
  s.connect('A','G');assert.deepEqual(tutorialContent(s).targets,['play']);s.start();
  assert.equal(tutorialContent(s).demo,null);assert.deepEqual(tutorialContent(s).targets,[]);
});

test('先に最速を発見しても別の道へ案内し、遅い比較を速くなったと表示しない',()=>{
  const s=session();s.beginGuide();s.connectPath(['S','A','B','G']);assert.deepEqual(tutorialContent(s).targets,['play'],'A complete alternative is playable, not an extra-wire repair');run(s,'3');s.remove('BG',true);
  assert.deepEqual(tutorialContent(s).demo,{from:'A',to:'G',kind:'drag'});
  s.connect('A','G');assert.deepEqual(tutorialContent(s).targets,['play']);run(s,'4');
  assert.match(tutorialContent(s).text,/2.5秒 → 4秒/);assert.doesNotMatch(tutorialContent(s).text,/速くなりました/);
});

test('元と同じ道を再作成した時は削除へ戻し、足りない後半だけならその先を示す',()=>{
  const s=session();s.beginGuide();s.connectPath(['S','A','G']);run(s,'4');s.remove('AG',true);s.connect('A','G');run(s,'4');
  assert.equal(tutorialContent(s).demo.kind,'hold');assert.equal(tutorialContent(s).demo.edge,'AG');
  s.remove('AG',true);s.connect('A','C');assert.deepEqual(tutorialContent(s).demo,{from:'C',to:'G',kind:'drag'});
});

test('記録後の章移動と三つの鐘の不足区間を示し、補足も全文案内へ残す',()=>{
  const s=session();s.beginGuide();s.connectPath(['S','A','G']);run(s,'4');s.remove('AG',true);s.connectPath(['A','B','G']);run(s,'3');s.openRecords();
  assert.equal(tutorialContent(s).canNext,true);s.nextGuideLesson();
  for(const [from,to]of [['S','A'],['A','B'],['A','C'],['B','G1'],['B','G2'],['C','G3']]){
    const copy=tutorialContent(s);assert.deepEqual(copy.demo,{from,to,kind:'drag'});assert(copy.fullText.includes(copy.note));s.connect(from,to);
  }
  assert.deepEqual(tutorialContent(s).targets,['play']);run(s,'3');assert.equal(tutorialContent(s).count,'CLEAR');assert.equal(tutorialContent(s).demo,null);
});

test('三本を未完成の分岐へ使った時は、追加不能な指示ではなく余分な線の削除を示す',()=>{
  const s=session();s.beginGuide();s.connectPath(['S','A','G']);run(s,'4');s.remove('AG',true);s.connect('A','B');s.connect('A','C');
  const copy=tutorialContent(s);assert.equal(copy.demo.kind,'hold');assert.equal(copy.demo.edge,'AC');assert.deepEqual(copy.targets,['AC']);
  s.remove('AC',true);assert.deepEqual(tutorialContent(s).demo,{from:'B',to:'G',kind:'drag'});s.connect('B','G');run(s,'3');assert.equal(s.guide.step,3);
});
