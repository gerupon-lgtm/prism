const point = (id,kind,x,y,process='0') => ({id,kind,x,y,process});
const path = (id,from,to,time) => ({id,from,to,time});
const diamond = () => [point('S','source',0.5,0.1,'0.5'),point('A','prism',0.25,0.45,'0.5'),point('B','prism',0.75,0.45,'0.5'),point('G','goal',0.5,0.87)];
const diamondEdges = () => [path('SA','S','A','1'),path('AG','A','G','1'),path('SB','S','B','1'),path('BG','B','G','1')];
const faultNodes = () => [point('S','source',0.5,0.1,'0.5'),point('A','prism',0.18,0.46),point('B','prism',0.5,0.46),point('C','prism',0.82,0.46),point('G','goal',0.5,0.86)];
const faultEdges = () => ['A','B','C'].flatMap(id=>[path(`S${id}`,'S',id,'1'),path(`${id}G`,id,'G','1')]);

// Initial content values are implementation proposals; baseline validation is separate.
export const challenges = [
  {id:'Q1',version:1,name:'はじめの一音',stage:'夜空の遺跡',type:'time',limit:2,baseline:'2.5',goal:'G',nodes:diamond(),candidates:diamondEdges()},
  {id:'Q2',version:1,name:'早く届けよう',stage:'夜空の遺跡',type:'time',limit:2,baseline:'2.5',goal:'G',nodes:[...diamond(),point('C','prism',0.5,0.63,'1')],candidates:[...diamondEdges(),path('SC','S','C','0.8'),path('CG','C','G','1')]},
  {id:'Q3',version:1,name:'速く、少ない道で',stage:'夜空の遺跡',type:'time-hops',limit:3,baseline:'2.5',baselineHops:2,goal:'G',nodes:[...diamond(),point('C','prism',0.44,0.32),point('D','prism',0.5,0.65)],candidates:[...diamondEdges(),path('SC','S','C','0.5'),path('CD','C','D','0.5'),path('DG','D','G','1.5')]},
  {id:'Q4',version:1,name:'道が一本使えなくても',stage:'ドーム型天文台',type:'edge-fault',limit:4,baseline:'2',goal:'G',nodes:faultNodes(),candidates:faultEdges()},
  {id:'Q5',version:1,name:'プリズムが使えなくても',stage:'ドーム型天文台',type:'prism-fault',limit:4,baseline:'2',goal:'G',nodes:faultNodes(),candidates:faultEdges()},
  {id:'Q6',version:1,name:'間隔をそろえて鳴らそう',stage:'ドーム型天文台',type:'interval',limit:4,baseline:'1',goal:'G',interval:'2',count:3,
    nodes:[point('S','source',0.5,0.1,'0.5'),point('A','prism',0.25,0.45),point('B','prism',0.78,0.45),point('G','goal',0.5,0.87)],
    candidates:[path('direct1','S','G','1'),path('direct3','S','G','3'),path('direct5','S','G','5'),path('SA','S','A','0.5'),path('AG1','A','G','0.5'),path('AG3','A','G','2.5'),path('AG5','A','G','4.5'),path('AB','A','B','0.5'),path('BA','B','A','0.5')],
  },
];

export function challengeCircuit(challenge, selected = []) {
  const edges = selected.map(id=>{
    const edge = challenge.candidates.find(candidate=>candidate.id===id);
    if (!edge) throw new Error('候補にない道です。');
    return structuredClone(edge);
  });
  if (new Set(selected).size !== selected.length || selected.length > challenge.limit) throw new Error('道の本数制限を超えています。');
  return {mode:challenge.type==='interval'?'spread':'fastest',target:challenge.goal,nodes:structuredClone(challenge.nodes),edges};
}
