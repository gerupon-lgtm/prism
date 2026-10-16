export const REVISION='2026.10.17-1';
export const GROUPS=[
  {id:'perfect',title:'100点のファンファーレ',prefix:'F',context:true,description:'短いブラスの祝福。鐘のあと0.7秒から始まり、2.7秒の操作復帰に収めます。'},
  {id:'clear',title:'通常クリア',prefix:'C',context:true,description:'達成を穏やかに知らせる短い音楽。100点のファンファーレと差を付けます。'},
  {id:'failure',title:'未達成',prefix:'N',context:true,description:'再挑戦を促す控えめな下降形。鐘のあと1.5秒から始まります。'},
  {id:'tap',title:'操作ボタン',prefix:'T',description:'短く、繰り返し押しても邪魔になりにくい音。'},
  {id:'wire',title:'結線できたとき',prefix:'W',description:'つながったことを知らせる小さな上向きの音。'},
  {id:'relay',title:'プリズム到着',prefix:'R',description:'到着1回につき1回だけ鳴る、短い「ピコン」の方向。'},
];
const n=(midi,at,duration,instrument,gain=.08)=>({midi,at,duration,instrument,gain});
const chord=(notes,at,duration,instrument,gain)=>notes.map(midi=>n(midi,at,duration,instrument,gain));
export const CANDIDATES=[
  {id:'F1',group:'perfect',name:'王道の祝福',description:'短い同音の呼びかけから、明るいブラスの和音へ。',recommended:true,notes:[
    n(69,0,.09,'brass',.12),n(69,.14,.09,'brass',.12),n(69,.28,.09,'brass',.12),n(76,.46,.22,'brass',.12),n(81,.8,.55,'brass',.11),...chord([57,69,73,76],.8,.55,'brass',.035),
  ]},
  {id:'F2',group:'perfect',name:'星の祝祭',description:'上へ駆け上がるブラスに、明るい鍵盤を重ねた華やかな案。',notes:[
    n(76,0,.09,'brass',.10),n(81,.12,.09,'brass',.10),n(85,.24,.12,'brass',.10),n(88,.42,.13,'brass',.09),n(81,.62,.15,'brass',.11),n(83,.82,.10,'brass',.10),n(81,1,.36,'brass',.11),...chord([69,73,76],1,.36,'fm-piano',.045),
  ]},
  {id:'F3',group:'perfect',name:'夜空の凱歌',description:'少し落ち着いたブラスと弦の和音。堂々とした祝福。',notes:[
    n(73,0,.13,'brass',.11),n(76,.18,.15,'brass',.11),n(81,.4,.27,'brass',.11),n(80,.78,.12,'brass',.09),n(81,.96,.48,'brass',.11),...chord([57,64,73,76],.96,.48,'strings',.04),
  ]},
  {id:'C1',group:'clear',name:'小さな達成',description:'柔らかなエレピで、上向きに短く解決。',recommended:true,notes:[
    n(69,0,.18,'piano',.10),n(73,.18,.18,'piano',.10),n(76,.4,.2,'piano',.10),...chord([69,73,81],.67,.28,'piano',.055),
  ]},
  {id:'C2',group:'clear',name:'光のマレット',description:'澄んだ打鍵音で軽やかに。鐘より短く、明るく。',notes:[
    n(76,0,.12,'wood',.075),n(73,.18,.12,'wood',.075),n(81,.43,.28,'wood',.08),n(69,.43,.28,'sine',.04),
  ]},
  {id:'C3',group:'clear',name:'やわらかな余韻',description:'鍵盤の合図から、穏やかな弦の和音へ。',notes:[
    n(73,0,.18,'piano',.10),n(76,.24,.18,'piano',.10),...chord([57,69,73,76],.52,.35,'strings',.05),
  ]},
  {id:'N1',group:'failure',name:'もう一歩',description:'丸い音で静かに下がる。強く責めない案。',recommended:true,notes:[
    n(64,0,.20,'soft',.10),n(62,.25,.20,'soft',.10),n(61,.5,.25,'soft',.09),
  ]},
  {id:'N2',group:'failure',name:'鍵盤のため息',description:'エレピの下降3音。結果が伝わる、少し明確な案。',notes:[
    n(64,0,.18,'piano',.11),n(60,.25,.18,'piano',.10),n(57,.52,.25,'piano',.10),
  ]},
  {id:'N3',group:'failure',name:'夜の小さな陰り',description:'短い弦の和音を下へ。落ち着いた再挑戦の合図。',notes:[
    ...chord([57,60,64],0,.25,'strings',.055),...chord([52,55,59],.45,.3,'strings',.05),
  ]},
  {id:'T1',group:'tap',name:'丸いタッチ',description:'控えめで丸い、短い1音。',recommended:true,notes:[n(76,0,.035,'soft',.13)]},
  {id:'T2',group:'tap',name:'澄んだタッチ',description:'小さな打鍵の輪郭がある1音。',notes:[n(81,0,.025,'wood',.10)]},
  {id:'T3',group:'tap',name:'軽いタッチ',description:'乾いたエレピを小さく鳴らす1音。',notes:[n(73,0,.03,'piano',.13)]},
  {id:'W1',group:'wire',name:'つながる2音',description:'丸い2音で、つながったことを知らせる。',recommended:true,notes:[n(76,0,.035,'soft',.12),n(81,.065,.045,'soft',.13)]},
  {id:'W2',group:'wire',name:'光る接点',description:'高めの打鍵音が短く上へ。',notes:[n(81,0,.025,'wood',.08),n(85,.055,.035,'wood',.09)]},
  {id:'W3',group:'wire',name:'軽いはめ込み',description:'エレピの2音。操作音より明るい到達感。',notes:[n(73,0,.03,'piano',.10),n(81,.07,.045,'piano',.12)]},
  {id:'R1',group:'relay',name:'丸いピコン',description:'重なりを抑えた、柔らかな2音の到着合図。',recommended:true,notes:[n(73,0,.04,'soft',.13),n(76,.075,.07,'soft',.12)]},
  {id:'R2',group:'relay',name:'光片のきらめき',description:'短い打鍵音で、プリズムの輝きを表す。',notes:[n(85,0,.055,'wood',.105)]},
  {id:'R3',group:'relay',name:'鍵盤のピコン',description:'少し低めのエレピ。操作・結線の音と区別する。',notes:[n(69,0,.035,'fm-piano',.10),n(76,.07,.06,'fm-piano',.09)]},
];
