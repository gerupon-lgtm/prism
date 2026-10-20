export const PARTS=[
  {art:'source',name:'星の光',summary:'光の出発点。ここから鐘へ配線をつなぎます。',detail:'光が戻ってきた星は、表示された秒数で処理してから再び分岐します。最初の出発には、この処理時間はかかりません。帰還の課題は最初の指定回数までを判定し、光を自動で止めます。'},
  {art:'prism',name:'プリズム',summary:'光の中継点。道の時間に加え、表示された処理時間もかかります。'},
  {art:'reflection',name:'鏡',summary:'1回タップして、離れた回転盤のつまみをドラッグ。鏡を回し、虹色の反射光を相手へ向けます。',detail:'最初はどこにも照準が合っていません。入ってくる光と鏡の面に合わせて反射光が動き、候補の近くでは吸い付きます。そのまま指を離すと結線でき、細かな角度合わせや設定画面は不要です。回転中は他の配線操作に反応しません。周囲をタップするか×で回転操作を閉じます。外して離すと元の配線を残します。反射先は一つで、変更時は前の出力を置き換えるため、配線が上限でも向きを変えられます。盤面下の左右回転ボタンや、鏡にフォーカスして矢印キーでも操作できます。複数方向から入った光も、選んだ一つの反射先へ送ります。'},
  {art:'periodic',name:'開閉するプリズム',summary:'一定の周期で開閉します。閉じている間も光は消えず、次に開くまで待ちます。',detail:'輪と「開・閉」の残り秒数で状態を確認できます。開いている間に処理を始めた光は、途中で閉じても最後まで進みます。開始前も周期が進み、「鐘を鳴らす」を押した時の状態で実行します。開始演出や音の遅れは計算に加えません。待ってもクリアでき、より早い到達で満点を狙えます。'},
  {art:'goal',name:'祭壇の鐘',summary:'光の到着先。光が届くと鐘が鳴り、星の光が浮かびます。'},
  {art:'wire',name:'配線',summary:'光を運ぶ道。点線は候補、金色の線は結線済み。秒数は移動にかかる時間です。',detail:'点から候補へドラッグするとつながります。結線済みの線を長押しすると、その1本が赤くなり、削除確認が開きます。「OK」で削除、「取消」または確認の外側を押すと残します。「クリア」はすべての配線を消します。点の位置や設定は保持します。'},
];
export const PLAY_GUIDE=[
  {art:'connect',name:'1　光をつなぐ',summary:'星から候補へドラッグ。指を離さず、次の点へ続けてつなげます。',detail:'点線は選べる候補、金色の線はつないだ配線です。課題の「配線 上限・使用・残り」を見ながら道を選びます。つなぎ始めると、その先の候補と結線済みの秒数に絞って表示します。「秒数 全体」で全候補の時間を確認できます。'},
  {art:'travel',name:'2　鐘を鳴らす',summary:'道の秒数とプリズムの処理時間を考え、「鐘を鳴らす」を押します。',detail:'光は配線を進み、プリズムで処理されてから次へ向かいます。分岐や合流では到着時間や待ち時間も変わります。途中で見直すときは「停止」で編集へ戻ります。'},
  {art:'result',name:'3　結果を比べる',summary:'到着時間と点数を確認。「記録」で光が通った道も確かめられます。',detail:'課題は最短のほか、すべての鐘に届ける、間隔をそろえる、指定した順に鐘を鳴らす、故障に備えるものもあります。条件を読んで、別の配線も試しましょう。複数の鐘の時間は最後の鐘への到達で比べます。「もう一度」は今の配線を残し、「次へ」は次の課題へ進みます。'},
  {art:'remove',name:'4　つなぎ直す',summary:'線を長押し → 赤い線を確認 →「OK」。その1本だけ消せます。',detail:'削除確認で「取消」または外側を押すと、線を残して閉じます。「クリア」は配線をまとめて消します。点や設定は残ります。結線済みの線はタップ、星・プリズム・鐘はダブルタップで設定を開けます。鏡は1回タップして、盤面で直接回します。'},
  {art:'reflection',name:'鏡で光を導く',summary:'鏡をタップし、離れた回転盤で反射光をプレビュー。相手に吸い付いたら指を離します。',detail:'初めは照準が外れています。入ってくる光、鏡の面、虹色の反射光を見ながら向きを探しましょう。精密な角度合わせは不要です。回転盤の位置は操作中に動かず、他の配線操作にも反応しません。周囲のタップか×で回転操作を終了します。鏡まで結線して指を離すと、約0.2秒後に回転盤が表示されます。待機中に別の操作をすると自動選択を取り消します。鏡を直接タップするとすぐに回せます。照準が外れたまま離しても、鏡までの受け付け済みの配線は残ります。反射先を変えると前の出力だけを置き換えます。左右ボタン・矢印キーは候補の向きへ順に回してつなぎます。ほぼ同じ方向に相手が重なるときも、細かな角度合わせなしで選べます。'},
  {art:'view',name:'表示とモード',summary:'2本指で表示を動かし、＋／−で拡大縮小。練習や自由作成も選べます。',detail:'スマホでは2本指で表示移動・ピンチで拡大縮小、PCではマウスで表示移動できます。「全体」で回路を見渡せます。「補助」は指元の拡大表示を切り替えます。お試し6問と、6面ずつの実践6セット（全42面）があります。チュートリアルで練習し、連続プレイ・選択プレイ・自由作成から遊べます。「プレイ画面へ」は現在の配線・記録に戻る入口です。音はヘッダー、演出と更新はこの画面下のボタンから変更できます。'},
];
const ns='http://www.w3.org/2000/svg';
export function helpArt(kind) {
  const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 260 100');svg.setAttribute('aria-hidden','true');svg.classList.add('help-art');
  const add=(tag,attrs={},text='')=>{const e=document.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))e.setAttribute(key,value);e.textContent=text;svg.append(e);return e;};
  const line=(x1,y1,x2,y2,extra={})=>add('line',{x1,y1,x2,y2,stroke:'#ecd082','stroke-width':4,'stroke-linecap':'round',...extra});
  const label=(x,y,text,attrs={})=>add('text',{x,y,fill:'#f8f4e9','text-anchor':'middle','font-size':14,...attrs},text);
  const asset=(name,x,y,size=66)=>add('image',{href:new URL(`../../public/graphics/${name}.png`,import.meta.url).href,x:x-size/2,y:y-size/2,width:size,height:size});
  if(kind==='reflection'){
    line(22,85,119,48,{stroke:'#e9d49a','stroke-width':3});
    const colors=['#ffe7ac','#ffc3e9','#c9c2ff','#a8e9ff','#d6ffc6'];for(let i=0;i<5;i++)line(119+(210-119)*i/5,48+(18-48)*i/5,119+(210-119)*(i+1)/5,48+(18-48)*(i+1)/5,{stroke:colors[i],'stroke-width':4,'stroke-dasharray':'5 3'});
    asset('mirror',119,48,76);line(93,27,147,69,{stroke:'#e7f6ff','stroke-width':5});add('circle',{cx:221,cy:67,r:23,fill:'#102039',stroke:'#bde8ff','stroke-width':2});line(207,59,234,76,{stroke:'#e7f6ff','stroke-width':3});add('circle',{cx:234,cy:76,r:7,fill:'#23334b',stroke:'#bde8ff','stroke-width':2});asset('prism',224,20,34);label(48,22,'入る光');label(172,98,'離れた回転盤で操作');return svg;
  }
  if(['source','prism','goal','mirror'].includes(kind)){asset(kind,130,50,92);return svg;}
  if(kind==='periodic'){asset('prism',130,50,78);add('circle',{cx:130,cy:50,r:44,fill:'none',stroke:'#e3e8b0','stroke-width':3});label(49,55,'開');label(211,55,'閉');return svg;}
  if(kind==='wire'){line(24,28,236,28,{stroke:'#9aaaca','stroke-width':2,'stroke-dasharray':'6 6'});line(24,72,236,72);label(130,19,'候補');label(130,95,'結線済み');return svg;}
  if(kind==='remove'){
    line(20,36,164,36,{stroke:'#ff9d96'});add('circle',{cx:86,cy:36,r:19,fill:'#101827',stroke:'#ffcf97','stroke-width':2});add('circle',{cx:86,cy:36,r:6,fill:'#ffe3ae'});label(86,80,'長押し');add('rect',{x:186,y:20,width:58,height:35,rx:8,fill:'#d6b56a'});label(215,43,'OK',{fill:'#111827','font-weight':'bold'});return svg;
  }
  if(kind==='result'){
    for(const [x,title,value]of [[14,'到着時間','2.5秒'],[139,'スコア','100点']]){add('rect',{x,y:7,width:107,height:84,rx:10,fill:'#1c2941',stroke:'#52658a'});label(x+53,32,title);label(x+53,68,value,{'font-size':24,fill:'#f4d78f','font-weight':'bold'});}return svg;
  }
  if(kind==='view'){
    add('circle',{cx:45,cy:48,r:9,fill:'#ffe3ae'});add('circle',{cx:87,cy:48,r:9,fill:'#ffe3ae'});line(26,74,109,74,{'stroke-width':2});label(67,22,'2本指');
    for(const [x,text]of [[143,'−'],[187,'全体'],[231,'＋']]){add('rect',{x:x-20,y:30,width:40,height:39,rx:8,fill:'#1c2941',stroke:'#7184a3'});label(x,55,text,{'font-size':text==='全体'?13:22});}return svg;
  }
  line(31,50,229,50);asset('source',30,50,48);asset('prism',130,50);asset('goal',231,50);
  if(kind==='travel'){add('circle',{cx:79,cy:50,r:6,fill:'#fff4c7',stroke:'#f5ce7e','stroke-width':4});label(80,20,'1秒');label(130,94,'処理 0.5秒');label(183,20,'1秒');}
  else {line(37,89,117,89,{'stroke-width':2});label(187,94,'続けてドラッグ');add('circle',{cx:76,cy:50,r:12,fill:'#182239',stroke:'#f3d598','stroke-width':2});}
  return svg;
}
