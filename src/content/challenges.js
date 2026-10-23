import {briskVersions} from './brisk-revisions.js';
import {balancedDeliveryRevisions} from './balanced-delivery.js';
import {balancedRhythmRevisions} from './balanced-rhythm.js';
import {themedChallenges} from './themed-challenges.js';
import {sequenceChallenges} from './sequence-challenges.js';
import {returnChallenges} from './return-challenges.js';
import {mirrorChallenges} from './mirror-challenges.js';
import {gateChallenges} from './gate-challenges.js';
const point = (id,kind,x,y,process='0') => ({id,kind,x,y,process});
const path = (id,from,to,time) => ({id,from,to,time});
const prism = (id,x,y,process='0.5') => point(id,'prism',x,y,process);
const diamond = () => [point('S','source',0.5,0.1,'0.5'),point('A','prism',0.25,0.45,'0.5'),point('B','prism',0.75,0.45,'0.5'),point('G','goal',0.5,0.87)];
const diamondEdges = () => [path('SA','S','A','1'),path('AG','A','G','1'),path('SB','S','B','1'),path('BG','B','G','1')];
const searchNodes = () => [point('S','source',0.5,0.1,'0.5'),point('A','prism',0.2,0.34,'0.5'),point('B','prism',0.8,0.34,'0.5'),point('C','prism',0.5,0.58,'0.5'),point('G','goal',0.5,0.92)];
const searchEdges = (shortcut) => [path('SA','S','A','0.5'),path('SB','S','B','0.5'),path('AC','A','C','0.5'),path('BC','B','C','0.5'),path('CG','C','G','0.5'),path('AG','A','G',shortcut),path('BG','B','G',shortcut),path('SC','S','C',shortcut)];
const resilientNodes = () => searchNodes().map(node=>node.id==='C'?{...node,process:'0'}:node);
const resilientEdges = () => [path('SA','S','A','0.5'),path('SB','S','B','0.5'),path('AC','A','C','0.5'),path('CG','C','G','1'),path('AG','A','G','1.5'),path('BG','B','G','1.5'),path('SC','S','C','1'),path('CB','C','B','0.5')];

// Initial content values are implementation proposals; baseline validation is separate.
const originalChallenges = [
  {id:'Q1',maxDuration:'2.5',version:1,name:'はじめの一音',stage:'夜空の遺跡',type:'time',limit:2,baseline:'2.5',goal:'G',nodes:diamond(),candidates:diamondEdges()},
  {id:'Q2',maxDuration:'3',version:2,name:'早く届けよう',stage:'夜空の遺跡',type:'time',limit:3,baseline:'2.5',goal:'G',nodes:searchNodes(),candidates:searchEdges('2')},
  {id:'Q3',maxDuration:'2.5',version:2,name:'速く、少ない道で',stage:'夜空の遺跡',type:'time-hops',limit:3,baseline:'2.5',baselineHops:2,goal:'G',nodes:searchNodes(),candidates:searchEdges('1.5')},
  {id:'Q4',maxDuration:'4',version:2,name:'道が一本使えなくても',stage:'ドーム型天文台',type:'edge-fault',limit:6,baseline:'2.5',goal:'G',nodes:resilientNodes(),candidates:resilientEdges()},
  {id:'Q5',maxDuration:'3.5',version:2,name:'プリズムが使えなくても',stage:'ドーム型天文台',type:'prism-fault',limit:6,baseline:'2.5',goal:'G',nodes:resilientNodes(),candidates:resilientEdges()},
  {id:'Q6',maxDuration:'8.5',version:2,name:'間隔をそろえて鳴らそう',stage:'ドーム型天文台',type:'interval',limit:6,baseline:'1',goal:'G',interval:'2',count:3,
    nodes:[point('S','source',0.5,0.1,'0.5'),point('A','prism',0.16,0.43),point('B','prism',0.5,0.52),point('C','prism',0.84,0.43),point('G','goal',0.5,0.92)],
    candidates:[path('SA','S','A','0.5'),path('AG','A','G','0.5'),path('SB','S','B','0.5'),path('BG','B','G','2.5'),path('SC','S','C','0.5'),path('CG','C','G','4.5'),path('AB','A','B','2'),path('BC','B','C','1.5')],
  },
  {id:'Q7',maxDuration:'5',version:2,name:'二つの祭壇へ',stage:'夜空の遺跡',world:'ruins',type:'delivery-all',limit:7,baseline:'4',goals:['G1','G2'],
    nodes:[point('S','source',.5,.07,'0.5'),prism('A',.5,.28),prism('B',.2,.51),prism('C',.8,.51),prism('D',.25,.74),prism('E',.75,.74),point('G1','goal',.25,.96),point('G2','goal',.75,.96)],
    candidates:[path('SA','S','A','0.5'),path('AB','A','B','0.5'),path('AC','A','C','0.5'),path('BD','B','D','0.5'),path('CE','C','E','0.5'),path('DG1','D','G1','0.5'),path('EG2','E','G2','1'),path('BG1','B','G1','2.5'),path('CG2','C','G2','2.5'),path('AD','A','D','1.5'),path('AE','A','E','1.5'),path('BE','B','E','1.5'),path('CD','C','D','1.5')],
  },
  {id:'Q8',maxDuration:'5',version:1,name:'三つの響きを導く',stage:'ドーム型天文台',world:'observatory',type:'delivery-all',limit:8,baseline:'4',goals:['G1','G2','G3'],
    nodes:[point('S','source',.5,.07,'0.5'),prism('A',.5,.28),prism('B',.22,.51),prism('C',.78,.51),prism('D',.25,.73),prism('E',.75,.73),point('G1','goal',.16,.96),point('G2','goal',.5,.96),point('G3','goal',.84,.96)],
    candidates:[path('SA','S','A','0.5'),path('AB','A','B','0.5'),path('AC','A','C','1'),path('BD','B','D','0.5'),path('CD','C','D','0.5'),path('DG1','D','G1','0.5'),path('DG2','D','G2','1'),path('EG3','E','G3','0.5'),path('BE','B','E','0.5'),path('CE','C','E','0.5'),path('AE','A','E','2'),path('BG1','B','G1','2.5'),path('CG2','C','G2','2'),path('AG3','A','G3','4')],
  },
  {id:'Q9',maxDuration:'7',version:1,name:'途中で分けて、さらに分ける',stage:'夜空の遺跡',world:'ruins',type:'interval',limit:8,baseline:'2.5',goal:'G',interval:'2',count:3,
    nodes:[point('S','source',.5,.07,'0.5'),prism('A',.3,.32),prism('B',.16,.6),prism('C',.5,.6),prism('D',.7,.32),prism('E',.84,.6),point('G','goal',.5,.94)],
    candidates:[path('SA','S','A','0.5'),path('AB','A','B','0.5'),path('BG','B','G','0.5'),path('BC','B','C','1'),path('CG','C','G','1'),path('CD','C','D','0.5'),path('DE','D','E','0.5'),path('EG','E','G','1'),path('AG','A','G','3'),path('AC','A','C','0.5'),path('BD','B','D','0.5'),path('CE','C','E','1.5')],
  },
  {id:'Q10',maxDuration:'7',version:1,name:'四つの光を一秒ずつ',stage:'ドーム型天文台',world:'observatory',type:'interval',limit:10,baseline:'3.5',goal:'G',interval:'1',count:4,
    nodes:[point('S','source',.5,.07,'0.5'),prism('A',.5,.28),prism('B',.2,.53),prism('C',.8,.53),prism('D',.25,.76),prism('E',.75,.76),prism('F',.8,.28),point('G','goal',.5,.96)],
    candidates:[path('SA','S','A','0.5'),path('AB','A','B','0.5'),path('AC','A','C','0.5'),path('BD','B','D','0.5'),path('BE','B','E','1.5'),path('CD','C','D','2.5'),path('CE','C','E','3.5'),path('DG','D','G','0.5'),path('EG','E','G','0.5'),path('BG','B','G','2'),path('CG','C','G','2.5'),path('CF','C','F','1.5'),path('FE','F','E','1.5')],
  },
  {id:'Q11',maxDuration:'5.5',version:1,name:'合流先の順番待ち',stage:'夜空の遺跡',world:'ruins',type:'interval',limit:6,baseline:'3.5',goal:'G',interval:'1',count:2,
    nodes:[point('S','source',.5,.07,'0.5'),prism('A',.5,.29),prism('B',.2,.53,'0'),prism('C',.8,.53,'0'),prism('D',.5,.76,'1'),point('G','goal',.5,.96)],
    candidates:[path('SA','S','A','0.5'),path('AB','A','B','0.5'),path('BD','B','D','0.5'),path('AC','A','C','1'),path('CD','C','D','0.5'),path('DG','D','G','0.5'),path('AD','A','D','1.5'),path('BG','B','G','1.2'),path('CG','C','G','0.7'),path('AG','A','G','2.2'),path('BC','B','C','0.5')],
  },
  {id:'Q12',maxDuration:'7',version:1,name:'三つの光、ひとつの合流点',stage:'ドーム型天文台',world:'observatory',type:'interval',limit:9,baseline:'3.5',goal:'G',interval:'1',count:3,
    nodes:[point('S','source',.5,.07,'0.5'),prism('A',.5,.29),prism('B',.2,.54,'0'),prism('C',.55,.52,'0'),prism('D',.8,.29,'0'),prism('E',.85,.54,'0'),prism('F',.5,.76,'1'),point('G','goal',.5,.96)],
    candidates:[path('SA','S','A','0.5'),path('AB','A','B','0.5'),path('BF','B','F','0.5'),path('AC','A','C','1'),path('CF','C','F','0.5'),path('AD','A','D','0.5'),path('DE','D','E','0.5'),path('EF','E','F','1'),path('FG','F','G','0.5'),path('AF','A','F','2'),path('AE','A','E','1'),path('BC','B','C','0.5'),path('AG','A','G','2.2')],
  },
];

// Keep old IDs and authored definitions; revised graphs receive separate content versions.
// Only presentation metadata changes when an existing problem moves to a set.
const order=['Q1','Q2','Q3','Q4','Q5','Q6','Q19','Q7','Q8','Q20','Q21','Q22','Q13','Q14','Q11','Q9','Q12','Q10','Q23','Q24','Q27','Q25','Q26','Q28',...returnChallenges.map(c=>c.id),...mirrorChallenges.map(c=>c.id),...gateChallenges.map(c=>c.id)];
// Presentation only: retain authored coordinates, problem IDs and old results.
// Direct routes must remain straight and visibly bypass intermediate parts.
const displayPositions={
  Q38:{C:{y:.83}},
  "Q7": {
    "D": {
      "x": 0.38,
      "y": 0.75
    },
    "E": {
      "x": 0.62,
      "y": 0.75
    }
  },
  "Q14": {
    "B": {
      "x": 0.13,
      "y": 0.54
    },
    "E": {
      "x": 0.87,
      "y": 0.54
    },
    "C": {
      "x": 0.41,
      "y": 0.7
    },
    "D": {
      "x": 0.59,
      "y": 0.7
    }
  },
  "Q23": {
    "A": {
      "x": 0.5,
      "y": 0.28
    },
    "B": {
      "x": 0.16,
      "y": 0.56
    },
    "C": {
      "x": 0.84,
      "y": 0.56
    },
    "D": {
      "x": 0.5,
      "y": 0.52
    }
  },
  "Q24": {
    "A": {
      "x": 0.5,
      "y": 0.28
    },
    "B": {
      "x": 0.16,
      "y": 0.56
    },
    "C": {
      "x": 0.84,
      "y": 0.56
    },
    "D": {
      "x": 0.5,
      "y": 0.52
    }
  }
};
const balancedRevisions={...balancedDeliveryRevisions,...balancedRhythmRevisions};
const themes=[{id:'intro',name:'お試し'},{id:'delivery',name:'すべての鐘へ',world:'starwalk',stage:'星渡りの回廊'},{id:'rhythm',name:'響く間隔をつくる',world:'moonwater',stage:'月映りの水殿'},{id:'sequence',name:'鐘の響きをつなぐ',world:'starecho',stage:'星響きの円環'},{id:'return',name:'星へ帰り、再び分かれる',world:'starreturn',stage:'星環の帰廊'},{id:'mirror',name:'鏡で光を導く',world:'moonmirror',stage:'月鏡の静殿'},{id:'gate',name:'星の門が開くとき',world:'stargate',stage:'星刻の開廊'}];
export const challenges=order.map((id,index)=>{
 const legacy=[...originalChallenges,...themedChallenges,...sequenceChallenges,...returnChallenges,...mirrorChallenges,...gateChallenges].find(c=>c.id===id),theme=themes[Math.floor(index/6)],revision=balancedRevisions[id];
 const original=revision?{...legacy,version:revision.version,balanceRevision:true,candidates:revision.candidates??legacy.candidates.filter(e=>!revision.removeCandidates?.includes(e.id))}:legacy;
 const positions=Object.fromEntries(Object.entries(revision?.positions??displayPositions[id]??{}).filter(([part,value])=>{const node=legacy.nodes.find(n=>n.id===part);return Object.entries(value).some(([key,v])=>v!==node[key]);}));
 return {...original,...(briskVersions[id]?{version:briskVersions[id],tempoRevision:true}:{}),number:index+1,set:theme.id,setName:theme.name,...(theme.world?{world:theme.world,stage:theme.stage}:{}),...(Object.keys(positions).length?{displayPositions:positions}:{}),
  ...(original.type==='delivery-all'?{bellPitches:original.goals.length===2?[88,84]:id==='Q21'?[84,79,72]:id==='Q22'?[72,77,81]:[72,79,84]}:{})};
});
export const challengeNumber=challenge=>challenge.number??Number(challenge.id.slice(1));
export const challengeLabel=challenge=>'Q'+challengeNumber(challenge);

export function challengeObjective(challenge) {
  if(challenge.type==='return-pattern')return `星へ戻って分岐し、${challenge.interval}秒間隔で最初の${challenge.count}回`;
  if(challenge.type==='bell-sequence')return `${challenge.goals.join('→')}の順${challenge.intervals?'・'+challenge.intervals.join('秒、')+'秒間隔':''}`;
  if(challenge.type==='delivery-all')return `祭壇${challenge.goals.join('・')}すべてに届ける`;
  if(challenge.type==='interval')return `${challenge.interval}秒間隔で${challenge.count}回`;
  return '';
}

export function challengeCircuit(challenge, selected = []) {
  const edges = selected.map(id=>{
    const edge = challenge.candidates.find(candidate=>candidate.id===id);
    if (!edge) throw new Error('候補にない道です。');
    return structuredClone(edge);
  });
  if (new Set(selected).size !== selected.length || selected.length > challenge.limit) throw new Error('道の本数制限を超えています。');
  const nodes=structuredClone(challenge.nodes);
  for(const node of nodes)if(node.kind==='mirror'){
    const outputs=edges.filter(edge=>edge.from===node.id);if(outputs.length>1)throw new Error('鏡の反射先は一つです。');
    node.reflectTo=outputs[0]?.to??node.reflectTo??null;
  }
  return {mode:['interval','delivery-all','bell-sequence','return-pattern'].includes(challenge.type)?'spread':'fastest',target:['delivery-all','bell-sequence'].includes(challenge.type)?'all':challenge.goal,nodes,edges};
}
