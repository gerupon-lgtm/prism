# 表示資材の出所

0.30.0では鐘の星座の線を星と同じ座標から作り、8個の星を7本の線でひと続きにつなぐ。星が輝いてから線が伸び、1800msの到着演出の終わりで一緒に消える。動きを減らす設定では完成した線を表示する。画像の生成・加工や音の変更はない。

0.29.0では到着演出を拡張し、プリズムは1000msの虹色の光片と光芒、鐘は1800msの光柱・金色の光芒・星座にする。満点時は2400msのSVG花火を重ね、既存の鐘の立ち上がりの0.42秒後から4音の短いジングルをWeb Audioで合成する。音の出所はsrc/ui/audio.jsの自作合成、画像の追加生成や外部音源はない。元のPNGは加工しない。いずれもゲーム内の時間へ加えず、音なし・停止・画面を離れる操作を尊重する。以下の1300msは0.28.0以前の履歴で、現行の到着演出時間へ流用しない。

0.21.0のタイトルは採用済みの遺跡R1・天文台O2とS1/P5/G3のPNGをCSSの濃淡で重ねて構成する。元PNGを加工・置換せず、盤面ではSVGの淡い陰影と道の背後色で分離する。到着演出はSVGのぼかしのある光と星を使用し、追加の生成画像はない。全て同じ資材版でオフライン準備へ含む。[点検](reviews/2026-10-14-mobile-title-arrival-update.md)を参照。

## 案内役の人型精霊

SD-059で採用した比較案2の人型精霊を、案内時だけ表示する。採用原本は[星の精霊比較案](../画面案/星の精霊比較案_v0.1.png)、本アプリ用資材は[spirit-guide.png](../public/spirit-guide.png)。比較案の背景や左側の精霊は本アプリへ採用していない。原本は変更していない。

2026-10-13、imagegenスキルと組み込みのimage_gen.imagegenを使い、原本を参照して右側の精霊だけを透過画像として作成した。1024×1536のRGBA PNG。画像生成結果を確認し、コピー後に透過とサイズを確認。追加の画像加工は行っていない。案内の閉鎖・通常プレイでは表示しない。資材は版付きで配信・オフライン準備へ含める。

使用した指示：

```text
Edit target: the attached adopted character comparison image. Extract ONLY the humanoid star spirit on the RIGHT (option 2) as a clean single game-guide character asset on a genuinely transparent background. Preserve the exact character identity and design faithfully: small floating humanoid, luminous silver-white wavy hair, simple warm gold oval eyes, tiny pale face, navy starry cape/cloak with delicate gold trim, chest star medallion, white translucent lower robe/feet, gold orbital line and small star over the head. Preserve original pose, expression, silhouette, colors, painterly illustration style and proportion. Remove ALL surrounding scenery, ruins, domes, sky, comparison divider, number 2, typography and the entire left option. Do not add scenery, objects, text, extra characters or redesign the character. Full figure with orbit and feet entirely visible, snug centered portrait composition, small transparent margin. This will appear at 44-64px tall in an actual guide; retain a clear recognizable silhouette and face.
```

## 舞台と光の表示

夜空の浮遊遺跡はQ1～3、ドーム型天文台はQ4～6に対応する。0.20.0から発案者が採用したS1/P5/G3/R1/O2を参照したPNGを表示する。出発点・プリズム・祭壇は透過画像、背景は表示範囲に合わせて収める。src/ui/scene.jsは画像の配置と星座を扱い、以前の線画の遺跡や天文台は現行表示には使わない。自由モードは背景二種を左右へ表示する。背景・星座は入力の対象や実験の出来事にしない。

資材はpublic/graphics/source.png（1254×1254）、prism.png（1254×1254）、goal.png（1024×1536）のRGBA PNG、ruins.png / observatory.png（1672×941）のRGB PNG。組み込みimage_genに比較案を参照させて生成し、画像を確認してコピーした。追加加工は行っていない。生成指示と採用原本は[グラフィック候補](../画面案/グラフィック候補_v0.1/README.md)、実画面の証拠は[課題見直し](../設計検証/課題見直し/report.json)。透過化・背景拡張は生成による再構成で、比較案と全画素同一という意味ではない。選択や結線候補の印を画像の周囲へ描き、版付きの配信と通信なし準備へ含める。

一到着につき光の粒と星座を1300ms表示する値は、実装時の調整値。実験の時計へ加算せず、同時到着の別々の粒・到着数・記録を保持する。停止や別の実験では古い演出を消す。外観の細部が利用者によって新たに承認されたという意味ではない。
