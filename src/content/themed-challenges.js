// New authored graphs. Stable IDs are independent of the player's display order.
const node=(id,kind,x,y,process='0.5')=>({id,kind,x,y,process:kind==='goal'?'0':process});
const edge=(from,to,time)=>({id:from+to,from,to,time:String(time)});
const s=()=>node('S','source',.5,.07),p=(id,x,y,t='0.5')=>node(id,'prism',x,y,t),g=(id,x,y)=>node(id,'goal',x,y);
export const themedChallenges=[
 {id:'Q19',version:1,name:'分かれ道の先に',type:'delivery-all',limit:5,baseline:'4',maxDuration:'12',goals:['G1','G2'],
  nodes:[s(),p('A',.5,.3),p('B',.22,.6),p('C',.78,.6),g('G1',.2,.94),g('G2',.8,.94)],
  candidates:[edge('S','A',.5),edge('A','B',.5),edge('A','C',1),edge('B','G1',.5),edge('C','G2',.5),edge('B','G2',3),edge('C','G1',3)]},
 {id:'Q20',version:1,name:'分岐を受け継ぐ光',type:'delivery-all',limit:7,baseline:'5',maxDuration:'12',goals:['G1','G2','G3'],
  nodes:[s(),p('A',.5,.27),p('B',.22,.48),p('C',.8,.6),p('D',.28,.72),g('G1',.16,.96),g('G2',.5,.96),g('G3',.84,.96)],
  candidates:[edge('S','A',.5),edge('A','B',.5),edge('A','C',1.5),edge('B','D',.5),edge('D','G1',.5),edge('D','G2',1),edge('C','G3',1),edge('A','D',3),edge('B','G1',3),edge('C','G2',3),edge('D','C',1)]},
 {id:'Q21',version:1,name:'三つの出口を探して',type:'delivery-all',limit:6,baseline:'5',maxDuration:'14',goals:['G1','G2','G3'],
  nodes:[s(),p('A',.5,.28),p('B',.25,.52),p('C',.7,.71),p('D',.82,.41),g('G1',.16,.94),g('G2',.5,.96),g('G3',.84,.94)],
  candidates:[edge('S','A',.5),edge('A','B',.5),edge('B','G1',1),edge('B','C',.5),edge('C','G2',.5),edge('C','G3',1),edge('A','D',.5),edge('D','C',2),edge('D','G3',3),edge('A','G2',4),edge('B','G3',4)]},
 {id:'Q22',version:1,name:'響きをつなぐ回廊',type:'delivery-all',limit:8,baseline:'5',maxDuration:'16',goals:['G1','G2','G3'],
  nodes:[s(),p('A',.5,.27),p('B',.2,.49),p('C',.8,.49),p('D',.23,.73),p('E',.77,.73),g('G1',.16,.96),g('G2',.5,.96),g('G3',.84,.96)],
  candidates:[edge('S','A',.5),edge('A','B',.5),edge('A','C',1),edge('B','D',.5),edge('C','E',.5),edge('D','G1',.5),edge('D','G2',1),edge('E','G3',1),edge('B','E',2),edge('C','D',2),edge('E','G2',2),edge('A','G1',4),edge('B','G3',4)]},
 {id:'Q13',version:1,name:'ふたつの光、ふたつの時刻',type:'interval',limit:5,baseline:'3',maxDuration:'12',goal:'G',interval:'1',count:2,
  nodes:[s(),p('A',.5,.28),p('B',.16,.56,'0'),p('C',.5,.65,'0'),p('D',.84,.56,'0'),g('G',.5,.95)],
  candidates:[edge('S','A',.5),edge('A','B',.5),edge('B','G',1),edge('A','C',1),edge('C','G',1.5),edge('A','D',1.5),edge('D','G',2)]},
 {id:'Q14',version:1,name:'三つの流れ星',type:'interval',limit:7,baseline:'3',maxDuration:'14',goal:'G',interval:'1',count:3,
  nodes:[s(),p('A',.5,.26),p('B',.13,.55,'0'),p('C',.37,.7,'0'),p('D',.63,.7,'0'),p('E',.87,.55,'0'),g('G',.5,.96)],
  candidates:[edge('S','A',.5),edge('A','B',.5),edge('B','G',1),edge('A','C',1),edge('C','G',1.5),edge('A','D',1.5),edge('D','G',2),edge('A','E',2),edge('E','G',2.5),edge('B','C',2.3),edge('D','E',2.3)]},
];
