const point = (id,kind,x,y,process='0') => ({id,kind,x,y,process});
const path = (id,from,to,time) => ({id,from,to,time});
const diamond = () => [point('S','source',0.5,0.1,'0.5'),point('A','prism',0.25,0.45,'0.5'),point('B','prism',0.75,0.45,'0.5'),point('G','goal',0.5,0.87)];
const diamondEdges = () => [path('SA','S','A','1'),path('AG','A','G','1'),path('SB','S','B','1'),path('BG','B','G','1')];
const searchNodes = () => [point('S','source',0.5,0.1,'0.5'),point('A','prism',0.2,0.34,'0.5'),point('B','prism',0.8,0.34,'0.5'),point('C','prism',0.5,0.58,'0.5'),point('G','goal',0.5,0.92)];
const searchEdges = (shortcut) => [path('SA','S','A','0.5'),path('SB','S','B','0.5'),path('AC','A','C','0.5'),path('BC','B','C','0.5'),path('CG','C','G','0.5'),path('AG','A','G',shortcut),path('BG','B','G',shortcut),path('SC','S','C',shortcut)];
const resilientNodes = () => searchNodes().map(node=>node.id==='C'?{...node,process:'0'}:node);
const resilientEdges = () => [path('SA','S','A','0.5'),path('SB','S','B','0.5'),path('AC','A','C','0.5'),path('CG','C','G','1'),path('AG','A','G','1.5'),path('BG','B','G','1.5'),path('SC','S','C','1'),path('CB','C','B','0.5')];

// Initial content values are implementation proposals; baseline validation is separate.
export const challenges = [
  {id:'Q1',version:1,name:'はじめの一音',stage:'夜空の遺跡',type:'time',limit:2,baseline:'2.5',goal:'G',nodes:diamond(),candidates:diamondEdges()},
  {id:'Q2',version:2,name:'早く届けよう',stage:'夜空の遺跡',type:'time',limit:3,baseline:'2.5',goal:'G',nodes:searchNodes(),candidates:searchEdges('2')},
  {id:'Q3',version:2,name:'速く、少ない道で',stage:'夜空の遺跡',type:'time-hops',limit:3,baseline:'2.5',baselineHops:2,goal:'G',nodes:searchNodes(),candidates:searchEdges('1.5')},
  {id:'Q4',version:2,name:'道が一本使えなくても',stage:'ドーム型天文台',type:'edge-fault',limit:6,baseline:'2.5',goal:'G',nodes:resilientNodes(),candidates:resilientEdges()},
  {id:'Q5',version:2,name:'プリズムが使えなくても',stage:'ドーム型天文台',type:'prism-fault',limit:6,baseline:'2.5',goal:'G',nodes:resilientNodes(),candidates:resilientEdges()},
  {id:'Q6',version:2,name:'間隔をそろえて鳴らそう',stage:'ドーム型天文台',type:'interval',limit:6,baseline:'1',goal:'G',interval:'2',count:3,
    nodes:[point('S','source',0.5,0.1,'0.5'),point('A','prism',0.16,0.43),point('B','prism',0.5,0.52),point('C','prism',0.84,0.43),point('G','goal',0.5,0.92)],
    candidates:[path('SA','S','A','0.5'),path('AG','A','G','0.5'),path('SB','S','B','0.5'),path('BG','B','G','2.5'),path('SC','S','C','0.5'),path('CG','C','G','4.5'),path('AB','A','B','2'),path('BC','B','C','1.5')],
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
