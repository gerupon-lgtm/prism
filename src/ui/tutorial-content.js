// Copy describes the live circuit; only Session decides whether a lesson passed.
export function tutorialContent(session,coarse=false,{example=false}={}) {
  const guide=session.guide;if(!guide)return null;
  const edges=session.circuit.edges,has=(from,to)=>edges.some(e=>e.from===from&&e.to===to);
  const release=coarse?'指':'マウスボタン',double=coarse?'ダブルタップ':'ダブルクリック';
  const drag=(from,to)=>({from,to,kind:'drag'});
  const describe=(heading,text,note,targets=[],demo=null,extra={})=>({heading,text,note,targets:targets.filter(Boolean),demo,...extra});
  let copy;
  if(guide.readyToFinish){
    copy=describe('チュートリアルクリア！',guide.mode==='challenge'?'あなたの回路で、三つの響きが生まれました。':'道と待ち時間を変えて、光の進み方を比べられました。','「完了」で結果と、この先の遊びを見てみよう。');
  }else if(guide.mode==='challenge'){
    const first=guide.firstResult,comparison=guide.comparison;
    switch(guide.step){
      case 0:
        copy=!has('S','A')
          ?describe('星の光を、鐘へ',coarse?'星からAへ、指でなぞって離そう。':'星からAへドラッグして離そう。',`星を押したままAまで動かし、${release}を離します。`,['S','A'],drag('S','A'))
          :!has('A','G')&&!(has('A','B')&&has('B','G'))&&!(has('A','C')&&has('C','G'))
            ?describe('鐘まで、道をつなごう','プリズムAから鐘へ、同じようにつなごう。','破線は結べる道。金色になれば結線できています。',['A','G'],drag('A','G'))
            :describe('道ができました','「鐘を鳴らす」を押して、光を送り出そう。','つないだ道を光が進み、鐘へ届くと音が鳴ります。',['play']);
        break;
      case 1: {
        const wire=edges.find(e=>e.id===guide.wireId);
        copy=describe('鳴った！ 道を変えたら？',session.editable?'光っている線を長押し。「OK」で1本消してみよう。':'鐘の余韻を聴こう。再生が終わったら、光っている線を長押しします。',`最初の到達は${first?.time??''}秒。線の秒数と、プリズムの待ち時間に注目。`,session.editable?[guide.wireId]:[],session.editable&&wire?{...drag(wire.from,wire.to),edge:wire.id,kind:'hold'}:null);
        break;
      }
      case 2: {
        const via=has('A','B')?'B':has('A','C')?'C':null;
        if(!has('S','A'))copy=describe('道は、何度でも変えられる','星からAへつなぎ直そう。','消すのは1本ずつ。残した道はそのまま使えます。',['S','A'],drag('S','A'));
        else if(!first?.edges.includes('AG'))copy=has('A','G')?describe('違う道を、聴き比べよう','「鐘を鳴らす」で、Aから鐘への道を試そう。','最初から早い道を見つけられました。今度は別の道との違いを確かめます。',['play']):describe('別の道は、どうだろう？','Aから鐘への道をつないで、比べてみよう。','最初から早い道を見つけられました。速さの違いを確かめよう。',['A','G'],drag('A','G'));
        else if(has('A','G'))copy=describe('別の道を、試してみよう','Aから鐘への線を、長押しして消そう。','さっきと同じ道です。左右のプリズムを通る道も試せます。',['AG'],{from:'A',to:'G',edge:'AG',kind:'hold'});
        else if(via&&!has(via,'G'))copy=describe('その道の先を、鐘へ',`プリズム${via}から鐘へつなごう。`,'早さは、通る線の秒数とプリズムの待ち時間の合計。',[via,'G'],drag(via,'G'));
        else if(via&&has(via,'G'))copy=describe('予想した道を、試してみよう','もう一度「鐘を鳴らす」。前の道と比べよう。',`最初の到達は${first?.time??''}秒。今度は何秒で届くでしょう？`,['play']);
        else copy=describe('短い道より、早い道？','Aから左右のプリズムを経由して、鐘へつなごう。','「秒数 全体」で候補の秒数を見比べられます。',example?['A','B']:['B','C','candidate-times'],example?drag('A','B'):null,{canExample:true});
        break;
      }
      case 3: {
        const difference=Number(first?.time)-Number(comparison?.time),change=Number.isFinite(difference)&&difference>0?`${Number(difference.toFixed(3))}秒速くなりました！`:difference===0?'同じ時間で届く、別の道ができました。':'道を変えると、届く時間も変わります。';
        copy=describe('工夫が、結果に変わった',`${first?.time??''}秒 → ${comparison?.time??''}秒。「記録」で道を確認しよう。`,`${change} 早く届くほど高得点、最速なら100点です。`,['records']);
        break;
      }
      case 4:
        copy=describe('今度は、三つの響きへ','1回の実行で、三つの鐘が響く回路をつくろう。','光はプリズムで分かれます。鐘の音程も楽しんでください。',[],null,{canNext:true});
        break;
      case 5: {
        const routes=[['S','A'],['A','B'],['A','C'],['B','G1'],['B','G2'],['C','G3']],next=routes.find(([from,to])=>!has(from,to));
        const names={S:'星',A:'A',B:'B',C:'C',G1:'鐘1',G2:'鐘2',G3:'鐘3'};
        copy=next?describe('光を分けて、響きをつなぐ',`${names[next[0]]}から${names[next[1]]}へつなごう。`,next[0]==='A'||next[0]==='B'?'同じプリズムから、2本の道を出せます。':'三つの鐘へ届く、6本の道をつくります。',next,drag(...next))
          :describe('あなたの回路を、鳴らそう','「鐘を鳴らす」で、三つの響きを聴こう。','1回の実行から、低いド・ソ・高いド。',['play']);
        break;
      }
    }
  }else{
    const linkedA=has('S','A'),wire=edges.find(e=>e.id===guide.wireId);
    const steps=[
      edges.length?describe('道を比べる、小さな実験','「鐘を鳴らす」を押して、光の進み方を見よう。','2本の道のうち、早い方を光が進みます。',['play']):describe('光の道をつくろう','星からA、Aから鐘へつなごう。','つないだら「鐘を鳴らす」で試せます。',['S','A'],drag('S','A')),
      describe('道は、何度でも変えられる',session.editable?'光っている線を長押し。「OK」で1本消してみよう。':'「停止」で編集に戻り、光っている線を長押ししよう。','消した道は、またつなぎ直せます。',session.editable?[guide.wireId]:['stop'],session.editable&&wire?{...drag(wire.from,wire.to),edge:wire.id,kind:'hold'}:null),
      linkedA?describe('待ち時間を変えてみよう',`プリズムAを${double}して、「時間」を1.5秒に。`,'設定を変えると、早い道も変わります。',['A']):describe('別の早さを、試してみよう','星からプリズムAへつなぎ直そう。',`つないだらAを${double}して、待ち時間を変更します。`,['S','A'],drag('S','A')),
      describe('光は、どちらを通る？','もう一度「鐘を鳴らす」。Bを通る光を見よう。','Aの待ち時間が増えると、B経由の3秒が早くなります。',['play']),
    ];copy=steps[guide.step];
  }
  // A beginner can use the three wires on unfinished branches. Give a real
  // recovery action instead of asking for a fourth, impossible connection.
  if(guide.mode==='challenge'&&[0,2].includes(guide.step)&&copy?.demo?.kind==='drag'&&edges.length>=session.challenge.limit){
    const via=has('A','B')?'B':has('A','C')?'C':'B';
    const keep=guide.step===0||!guide.firstResult?.edges.includes('AG')?['SA','AG']:['SA',`A${via}`,`${via}G`];
    const spare=edges.find(edge=>!keep.includes(edge.id));
    if(spare)copy=describe('1本消して、道をつなぎ直そう','光っている線を長押しして、1本消そう。',`使える配線は${session.challenge.limit}本。残した道はそのまま使えます。`,[spare.id],{...drag(spare.from,spare.to),edge:spare.id,kind:'hold'});
  }
  const running=session.run===guide.run&&session.run?.status==='running'&&!session.run.exhausted;
  if(running){
    const harmony=guide.mode==='challenge'&&guide.step===5;
    copy=describe(harmony?'三つの響きを、聴いてみよう':'あなたの道を、光が進む',harmony?'光が分かれ、鐘1・鐘2・鐘3へ。':'鐘へ届く瞬間を、見てみよう。',harmony?'低いド → ソ → 高いド。ひとつの実行から三つの音へ。':'考えた道が、光と音になって返ってきます。');
  }
  copy??=describe('光の道をつくろう','つないで、鳴らして、試してみよう。','道は何度でも変えられます。');
  return {...copy,total:guide.mode==='challenge'?6:4,count:guide.readyToFinish?'CLEAR':`${guide.step+1} / ${guide.mode==='challenge'?6:4}`,key:`${guide.step}:${guide.readyToFinish}:${copy.heading}:${copy.demo?.from??''}:${copy.demo?.to??''}`,fullText:`${copy.heading}。${copy.text} ${copy.note}`};
}
