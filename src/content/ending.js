'use strict';
export const ending = (() => {
 const item = (name,x,y,w,h,cls='') => ({name,x,y,w,h,cls});
 const bell = (x,y,w,h) => item('goal',x,y,w,h,'bell');
 const spirit = (x=62,y=26,w=29,h=71) => item('spirit',x,y,w,h,'spirit');
 const panoramaBells=[bell(17,48,10,33),bell(47,44,12,38),bell(78,46,9,30)];
 const futureArt=[item('spirit-listening',23,20,24,59,'future-spirit'),item('monochord-story',24,43,57,37,'still-instrument'),item('hammer',9,76,20,15,'still-instrument')];
 const specs={
  complete:{bg:'ruins',art:[bell(14,48,15,44),bell(43,35,20,58),bell(76,48,15,44)],effect:'complete'},
  bell:{bg:'ruins',art:[bell(37,5,27,90)],effect:'bell'},
  first:{bg:'ruins',art:[item('source',12,58,15,24),item('prism',43,45,13,23),bell(72,24,18,61)],effect:'first'},
  observatory:{bg:'observatory',art:[item('prism',43,43,14,24),bell(73,24,18,59)],effect:'first'},
  far:{bg:'starwalk',art:[bell(15,43,16,49),bell(44,32,14,45),bell(74,26,10,34)],effect:'far'},
  water:{bg:'moonwater',art:[bell(24,23,18,50),bell(61,30,16,46)],effect:'water'},
  spirit:{bg:'starecho',art:[bell(18,33,16,47),spirit(60,22,31,75)],effect:'stars'},
  return:{bg:'starreturn',art:[item('source',43,12,19,28),bell(73,48,17,47)],effect:'return'},
  mirror:{bg:'moonmirror',art:[item('mirror',48,20,29,70)],effect:'mirror'},
  gate:{bg:'stargate',art:[item('prism',43,33,16,27),bell(76,27,16,53)],effect:'gate'},
  panorama:{bg:'panorama',art:panoramaBells,effect:'panorama'},
  thanks:{bg:'panorama',art:[bell(18,35,18,59),spirit(62,26,29,71)],effect:'stars'},
  quiet:{bg:'panorama',art:panoramaBells,effect:'quiet'},
  future:{bg:'forge-ruins',art:futureArt,effect:'future'},
  credits:{bg:'credits-background',art:[bell(22,43,18,53),spirit(59,39,24,58)],effect:'credits'},
 };
 const intro={id:'E1',scene:'complete',place:'いま · 最後の鐘',title:'余韻の向こうへ',words:'最後の鐘が応えました。あなたがつないだ道を、星の光が巡っていきます。'};
 const song=[
  {id:'S01',at:0,scene:'bell',place:'いま · 最後の祭壇',title:'ひとつの鐘',words:'星の光に、鐘が応えました。'},
  {id:'S02',at:4*60/72,scene:'first',place:'いま · 最初の光の道',title:'ひとつひとつは、一音',words:'それでも、あとに残る響きは、次の音と出会っていきます。'},
  {id:'S03',at:36*60/72,scene:'observatory',place:'いま · 天文台',title:'応えた道',words:'光を届けると、静かだった鐘が応えました。'},
  {id:'S04',at:52*60/72,scene:'far',place:'いま · 星渡りの回廊',title:'遠くの鐘',words:'光の道をつなぐと、遠くの鐘も鳴り始めました。'},
  {id:'S05',at:68*60/72,scene:'water',place:'いま · 月映りの水殿',title:'水面の余韻',words:'鳴らす時をずらすと、二つの余韻が水面で重なりました。'},
  {id:'S06',at:84*60/72,scene:'spirit',place:'いま · 星響の祭壇',title:'星の精霊',words:'鐘の余韻に、星の精霊もそっと耳を澄ませました。'},
  {id:'S07',at:100*60/72,scene:'return',place:'いま · 星環の帰廊',title:'巡る光',words:'戻ってきた光を受けて、道はさらに先へ続きました。'},
  {id:'S08',at:116*60/72,scene:'mirror',place:'いま · 月鏡の静殿',title:'鏡の先',words:'鏡の向きを変えると、見えなかった道が開きました。'},
  {id:'S09',at:132*60/72,scene:'gate',place:'いま · 星刻の開廊',title:'星の門',words:'光の輪が開くと、待っていた光が先へ進みました。'},
  {id:'S10',at:148*60/72,scene:'panorama',place:'いま · つながった夜空',title:'光が巡る',words:'つないだ道を、星の光が夜空いっぱいに巡っていきました。'},
  {id:'S11',at:164*60/72,scene:'thanks',place:'いま · あなたがつないだ響き',title:'ありがとう',speaker:'星の精霊',words:'光を届けてくださって、ありがとう。今夜の響きは、あなたがつないだものです。'},
  {id:'S12',at:192*60/72,scene:'panorama',place:'音楽について',title:'旋律の引用',words:'ドヴォルザーク作曲\n交響曲第9番「新世界より」\n第2楽章より\n旋律の一部を引用しています。',musicCredit:true},
  {id:'S13',at:208*60/72,scene:'quiet',place:'PRISM NOTES · 旅のおわり',title:'余韻の夜空',words:'旅を終えた夜空に、光の道が静かに残っていました。',finalWords:'鐘の余韻は、静かな夜空へ溶けていきました。'},
 ];
 const after=[
  {id:'E5',scene:'future',place:'その後、長い時が流れて · 鍛冶場の跡',title:'長い時の後',words:'そして、長い時が流れました。鐘を打ったあの場所で、今度は一本の弦が、誰かを待っています。'},
  {id:'E6',scene:'future',place:'長い時の後 · 次の旅のはじまり',title:'まだ知らない響きへ',words:'この一本の弦から、新しい旅が始まります。',nextStory:'ROOT NOTES'},
  {id:'C1',scene:'credits',place:'クレジット',title:'旅をともにした、\nあなたへ',words:'最後まで遊んでくださり、ありがとうございました。'},
 ];
 return {version:'0.1.4',musicVersion:'0.1.17',duration:224*60/72,specs,intro,song,after,
  music:new URL('../../public/ending/audio/PRISM_NOTES_ending_v0.1.17_A.mp3',import.meta.url).href};
})();
