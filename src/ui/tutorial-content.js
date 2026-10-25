// Copy and targets share the same step; Session owns actual progress.
export function tutorialContent(session,coarse=false) {
  const guide=session.guide;if(!guide)return null;
  const source=session.circuit.edges.find(edge=>edge.from==='S'),hasBell=session.circuit.edges.some(edge=>edge.to==='G');
  const linkedA=session.circuit.edges.some(edge=>edge.from==='S'&&edge.to==='A');
  const release=coarse?'指':'マウスボタン',double=coarse?'ダブルタップ':'ダブルクリック';
  const remove={text:session.editable?'光っている配線を長押し。赤い線を確認し、「OK」で1本消しましょう。':'「停止」で編集に戻り、光っている配線を長押しして「OK」で消しましょう。',targets:session.editable?[guide.wireId]:['stop']};
  const steps=guide.mode==='challenge'?[
    {text:`星からプリズムAへドラッグして、${release}を離しましょう。`,targets:['S','A']},
    remove,
    {text:source&&hasBell?'「鐘を鳴らす」を押して、光が鐘に届くまで見てみましょう。':source?`プリズム${source.to}から鐘へつなぎ、「鐘を鳴らす」を押しましょう。`:'星からプリズムA、鐘へつなぎ直し、「鐘を鳴らす」を押しましょう。',targets:source&&hasBell?['play']:source?[source.to,'G']:['S','A','G']},
    {text:'鐘へ早く届くほど高得点。最速なら100点です。「記録」で到着時間と道を確かめましょう。',targets:['records']},
  ]:[
    {text:session.circuit.edges.length?'「鐘を鳴らす」を押して、光の進み方を見てみましょう。':'星からプリズムA、鐘へつないで「鐘を鳴らす」を押しましょう。',targets:session.circuit.edges.length?['play']:['S','A','G']},
    remove,
    {text:linkedA?`プリズムAを${double}。「時間」を1.5秒に変えましょう。`:`星からプリズムAへつなぎ直し、Aを${double}して「時間」を1.5秒に変えましょう。`,targets:linkedA?['A']:['S','A']},
    {text:'もう一度「鐘を鳴らす」。プリズムB経由の3秒を確かめましょう。',targets:['play']},
  ];
  return {total:steps.length,text:guide.readyToFinish?'練習はクリアです。「完了」で結果と、高得点を目指すコツを確認しましょう。':steps[guide.step].text,targets:guide.readyToFinish?[]:steps[guide.step].targets.filter(Boolean)};
}
