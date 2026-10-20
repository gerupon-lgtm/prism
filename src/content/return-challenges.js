// The first N chimes are judged; a returning source can continue cycling.
const n=(id,kind,x,y,process='0.5')=>({id,kind,x,y,process});
const e=(from,to,time)=>({id:from+to,from,to,time:String(time)});
const nodes=(sourceProcess,relayProcess)=>[
 n('S','source',.5,.09,sourceProcess),
 n('A','prism',.21,.34,relayProcess),n('B','prism',.79,.34,relayProcess),
 n('C','prism',.21,.67,relayProcess),n('D','prism',.79,.67,relayProcess),
 n('G','goal',.5,.95,'0'),
];
const routes=()=>[e('S','A',.5),e('A','C',.5),e('C','S',.5),
 e('S','B',.5),e('B','D',.5),e('D','S',.5),
 e('A','G',1.5),e('B','G',.5),e('S','C',1.5),e('C','G',1.5),
 e('S','D',1.5),e('D','G',1.5),e('A','D',1.5),e('B','C',1.5)];
export const returnChallenges=[
 ['Q29','星へ帰る光',2,'3',5,'0.5','0.5'],
 ['Q30','二度目の分岐',3,'2.5',5,'0.5','0.25'],
 ['Q31','帰り道を選ぶ',3,'2',5,'0.5','0'],
 ['Q32','二つの響きと帰り道',4,'1',6,'0.5','0.25'],
 ['Q33','帰還を重ねて',5,'1.5',6,'0.75','0.25'],
 ['Q34','星環の交響',6,'1',6,'0.5','0'],
].map(([id,name,count,interval,limit,sourceProcess,relayProcess])=>({
 id,version:1,name,type:'return-pattern',goal:'G',count,interval,limit,
 baseline:'1',maxDuration:'60',nodes:nodes(sourceProcess,relayProcess),candidates:routes(),
}));
