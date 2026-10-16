export const REVISION='2026.10.17-2';
export const GROUPS=[
  {id:'perfect',title:'100点ファンファーレ',prefix:'F',context:true,description:'ブラス＋Strings。弾むリズムと明るい旋律で祝福する3案です。'},
  {id:'relay',title:'プリズム到着',prefix:'R',description:'採用済みの操作T2・結線W2と重ならない音の高さにした3案です。'},
];
const n=(midi,at,duration,instrument,gain=.10)=>({midi,at,duration,instrument,gain});
const chord=(notes,at,duration,gain=.035)=>notes.map(midi=>n(midi,at,duration,'strings',gain));
export const CANDIDATES=[
  {id:'F4',group:'perfect',name:'はずむ祝福',description:'上へ跳ねるブラスと、リズムを添える弦。',recommended:true,notes:[
    n(69,0,.075,'brass',.12),n(73,.12,.075,'brass',.12),n(76,.24,.09,'brass',.12),n(81,.42,.14,'brass',.12),n(85,.66,.08,'brass',.11),n(83,.8,.08,'brass',.11),n(81,1,.38,'brass',.12),
    ...chord([57,61,64],0,.12),...chord([59,68,71,76],.42,.13),...chord([57,69,73,76],1,.38,.045),
  ]},
  {id:'F5',group:'perfect',name:'星たちのパレード',description:'ブラスとStringsの掛け合い。高音へ駆け上がる楽しい案。',notes:[
    n(76,0,.10,'brass',.11),n(81,.18,.12,'brass',.11),n(83,.38,.12,'brass',.11),n(85,.58,.14,'brass',.11),n(88,.82,.10,'brass',.10),n(85,.96,.12,'brass',.11),n(81,1.14,.32,'brass',.12),
    n(73,.08,.12,'strings',.065),n(69,.26,.12,'strings',.065),n(76,.46,.12,'strings',.065),n(81,.68,.12,'strings',.065),...chord([57,69,73,76],1.14,.32,.045),
  ]},
  {id:'F6',group:'perfect',name:'小さな凱旋',description:'短く歯切れよいブラスと、明るく動く弦の和音。',notes:[
    n(69,0,.08,'brass',.12),n(76,.12,.08,'brass',.12),n(73,.24,.08,'brass',.12),n(76,.4,.12,'brass',.12),n(78,.6,.10,'brass',.12),n(76,.76,.10,'brass',.12),n(80,.94,.10,'brass',.11),n(81,1.12,.34,'brass',.12),
    ...chord([57,61,64],0,.16),...chord([62,69,74],.4,.16),...chord([64,71,76],.76,.16),...chord([57,69,73,76],1.12,.34,.045),
  ]},
  {id:'R4',group:'relay',name:'低めの結晶',description:'操作・結線より十分低い、透明な1音。',recommended:true,notes:[n(64,0,.075,'wood',.13)]},
  {id:'R5',group:'relay',name:'中音のピコン',description:'高い操作音と区別する、丸いエレピの1音。',notes:[n(71,0,.08,'piano',.13)]},
  {id:'R6',group:'relay',name:'跳ねる到着',description:'操作・結線と重ならない高さで、1オクターブ跳ねる短音。',notes:[n(66,0,.04,'soft',.15),n(78,.06,.07,'soft',.13)]},
];
