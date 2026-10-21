const n=(id,kind,x,y,process='0.5')=>({id,kind,x,y,process,...(kind==='mirror'?{reflectTo:null}:{})});
const e=(from,to,time='1')=>({id:from+to,from,to,time:String(Number(time))});
const source=()=>n('S','source',.5,.07),p=(id,x,y)=>n(id,'prism',x,y),m=(id,x,y)=>n(id,'mirror',x,y,'0'),g=(id,x,y)=>n(id,'goal',x,y,'0');
const one=(goals)=>[source(),p('A',.5,.27),m('M',.5,.49),p('C',.23,.72),p('D',.77,.72),...goals];
const two=goals=>[source(),p('A',.5,.27),m('M',.22,.49),m('N',.78,.49),p('C',.23,.73),p('D',.77,.73),...goals];
const common=[e('S','A','.5'),e('A','M','.5'),e('M','C','.5'),e('M','D','1'),e('A','C','4'),e('A','D','4')];
export const mirrorChallenges=[
 {id:'Q35',name:'鏡に光を預けて',limit:4,goals:['G'],nodes:one([g('G',.5,.96)]),candidates:[...common.filter(e=>!['AC','AD'].includes(e.id)),e('C','G','.5'),e('D','G','.5'),e('M','G','4')]},
 {id:'Q36',name:'反射の先で分かれる',limit:5,goals:['G1','G2'],nodes:one([g('G1',.25,.96),g('G2',.75,.96)]),candidates:[...common,e('C','G1','.5'),e('C','G2','1'),e('D','G1','1'),e('D','G2','.5'),e('M','G1','4'),e('M','G2','4')]},
 {id:'Q37',name:'二枚の鏡、二つの道',limit:7,goals:['G1','G2'],nodes:two([g('G1',.25,.96),g('G2',.75,.96)]),candidates:[e('S','A','.5'),e('A','M','.5'),e('A','N','.5'),e('M','C','.5'),e('M','D','1'),e('N','C','1'),e('N','D','.5'),e('C','G1','.5'),e('D','G2','.5'),e('M','G1','4'),e('N','G2','4'),e('A','C','4'),e('A','D','4')]},
 {id:'Q38',name:'鏡から鏡へ',limit:6,goals:['G1','G2'],nodes:[source(),m('M',.5,.27),p('B',.23,.47),p('D',.77,.47),m('N',.5,.65),p('C',.5,.8),g('G1',.25,.96),g('G2',.75,.96)],candidates:[e('S','M','.5'),e('M','B','.5'),e('M','D','1'),e('B','N','.5'),e('D','N','.5'),e('N','C','.5'),e('C','G1','.5'),e('C','G2','1'),e('M','N','4'),e('N','G1','4'),e('N','G2','4'),e('B','C','4'),e('D','C','4')]},
 {id:'Q39',name:'一つの反射、三つの響き',limit:6,goals:['G1','G2','G3'],nodes:one([g('G1',.16,.96),g('G2',.5,.96),g('G3',.84,.96)]),candidates:[...common,...['C','D'].flatMap(from=>['G1','G2','G3'].map((to,i)=>e(from,to,String(.5+i*.5))))]},
 {id:'Q40',name:'月鏡のアンサンブル',limit:8,goals:['G1','G2','G3'],nodes:two([g('G1',.16,.96),g('G2',.5,.96),g('G3',.84,.96)]),candidates:[e('S','A','.5'),e('A','M','.5'),e('A','N','.5'),e('M','C','.5'),e('M','D','1'),e('N','C','1'),e('N','D','.5'),e('C','G1','.5'),e('C','G2','.5'),e('D','G2','1.5'),e('D','G3','.5'),e('A','C','4'),e('A','D','4'),e('M','G1','4'),e('N','G3','4')]},
].map(c=>{
 const mirrors=new Set(c.nodes.filter(n=>n.kind==='mirror').map(n=>n.id));
 // Instant shortcuts would dominate every route through the downstream prisms.
 const shortcuts={Q35:['MG'],Q37:['MG1','NG2'],Q38:['MN'],Q40:['MG1','NG3']}[c.id]??[];
 return {...c,version:c.id==='Q35'?3:2,type:'delivery-all',baseline:'1',maxDuration:'60',
  candidates:c.candidates.filter(e=>!shortcuts.includes(e.id)).map(e=>({...e,time:mirrors.has(e.from)?'0':e.time}))};
});
