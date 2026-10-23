// Authored layout/route revisions. The challenge keeps its existing nodes,
// source/goal coordinates, processing times, limit and objective.
const edge=(from,to,time)=>({id:from+to,from,to,time:String(time)});
const fivePositions=()=>({
 A:{x:.5,y:.28},B:{x:.17,y:.48},C:{x:.83,y:.48},
 D:{x:.35,y:.73},E:{x:.65,y:.73},
});
const fourPositions=()=>({
 A:{x:.5,y:.28},B:{x:.16,y:.48},C:{x:.84,y:.48},D:{x:.5,y:.68},
});
// All paths move toward the bells. Cross-branch and direct alternatives add
// choices without introducing cycles or a path through another part.
const fiveRoutes=()=>[
 edge('S','A',.5),
 edge('A','B',.5),edge('A','C',1),
 edge('B','D',.5),edge('C','E',.5),
 edge('B','E',1),edge('C','D',1.5),
 edge('D','G1',.5),edge('E','G3',1),
 edge('D','G2',1.5),edge('E','G2',.5),
 edge('B','G1',2.5),edge('C','G3',2),
 edge('D','G3',2),edge('E','G1',2.5),
];
const fourRoutes=()=>[
 edge('S','A',.5),
 edge('A','B',.5),edge('A','C',1),
 edge('B','D',.5),edge('C','D',1),
 edge('D','G1',.5),edge('D','G2',1),edge('D','G3',1.5),
 edge('B','G1',2),edge('C','G3',2.5),
 edge('B','G2',2.5),edge('C','G2',1.5),
 edge('A','G1',3),edge('A','G3',3.5),edge('A','D',2),
];
const five=version=>({positions:fivePositions(),candidates:fiveRoutes(),version});
const four=version=>({positions:fourPositions(),candidates:fourRoutes(),version});
export const balancedDeliveryRevisions={
 Q8:five(2),Q20:four(2),Q21:four(2),Q22:{...five(2),candidates:[...fiveRoutes().filter(e=>!['BG1','CG3','DG3','EG1'].includes(e.id)),edge('A','D',.5),edge('A','E',.5)]},
 Q25:five(2),Q26:five(3),Q27:five(3),Q28:five(3),
};
