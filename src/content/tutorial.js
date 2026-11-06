// Practice-only conditions. The authored stages, draws and their identities stay
// unchanged; Session owns the temporary replacement and restores the old state.
const point=(id,kind,x,y,process='0')=>({id,kind,x,y,process});
const prism=(id,x,y,process='0.5')=>point(id,'prism',x,y,process);
const path=(id,from,to,time)=>({id,from,to,time});

export function tutorialChallenge(lesson='route') {
  const common={id:'Q1',number:1,version:2,practice:true,set:'tutorial',setName:'チュートリアル'};
  if(lesson==='route')return {
    ...common,name:'光の道をつくる',stage:'夜空の遺跡',world:'ruins',
    type:'time',limit:3,baseline:'2.5',maxDuration:'5',goal:'G',
    // Leave room between the full-size star and A even in 320px enlarged text.
    nodes:[point('S','source',.5,.1,'0.5'),prism('A',.5,.45),prism('B',.2,.62),prism('C',.8,.62),point('G','goal',.5,.94)],
    candidates:[path('SA','S','A','0.5'),path('AG','A','G','3'),path('AB','A','B','0.5'),path('BG','B','G','0.5'),path('AC','A','C','0.5'),path('CG','C','G','1.5')],
  };
  if(lesson==='branch')return {
    ...common,name:'三つの響きをつなぐ',stage:'星響きの円環',world:'starecho',
    type:'bell-sequence',limit:6,baseline:'3',maxDuration:'5',
    goals:['G1','G2','G3'],intervals:['0.5','0.5'],bellPitches:[72,79,84],
    nodes:[point('S','source',.5,.1,'0.5'),prism('A',.5,.36),prism('B',.22,.58,'0'),prism('C',.78,.58,'0'),point('G1','goal',.16,.94),point('G2','goal',.5,.94),point('G3','goal',.84,.94)],
    candidates:[path('SA','S','A','0.5'),path('AB','A','B','0.5'),path('AC','A','C','0.5'),path('BG1','B','G1','0.5'),path('BG2','B','G2','1'),path('CG3','C','G3','1.5')],
  };
  throw Error('練習の章が見つかりません。');
}
