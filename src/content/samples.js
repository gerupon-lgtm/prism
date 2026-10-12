const point = (id,kind,x,y,process='0') => ({id,kind,x,y,process});
const path = (id,from,to,time) => ({id,from,to,time});

export function sampleCircuit(id = 'compare') {
  if (id === 'compare') return {
    mode:'fastest', target:'G',
    nodes:[point('S','source',0.5,0.1,'0.5'),point('A','prism',0.25,0.45,'0.5'),point('B','prism',0.75,0.45),point('G','goal',0.5,0.85)],
    edges:[path('SA','S','A','1'),path('AG','A','G','1'),path('SB','S','B','1.5'),path('BG','B','G','1.5')],
  };
  if (id === 'loop') return {
    mode:'spread',target:'all',
    nodes:[point('S','source',0.5,0.08,'0.5'),point('A','prism',0.22,0.24),point('B','prism',0.78,0.24),point('C','prism',0.5,0.43,'1'),point('D','prism',0.82,0.57),point('E','prism',0.82,0.76),point('G1','goal',0.22,0.88),point('G2','goal',0.5,0.88)],
    edges:[path('SA','S','A','1'),path('SB','S','B','1'),path('AC','A','C','1'),path('BC','B','C','1'),path('CG1','C','G1','1'),path('CG2','C','G2','2'),path('CD','C','D','0.5'),path('DE','D','E','0.5'),path('EC','E','C','1')],
  };
  throw new Error('見本が見つかりません。');
}

export const samples = [{id:'compare',name:'速い道を比べる'},{id:'loop',name:'分かれて、待って、巡る'}];
