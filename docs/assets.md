# 表示資材の出所

## 案内役の人型精霊

SD-059で採用した比較案2の人型精霊を、案内時だけ表示する。採用原本は[星の精霊比較案](../画面案/星の精霊比較案_v0.1.png)、本アプリ用資材は[spirit-guide.png](../public/spirit-guide.png)。比較案の背景や左側の精霊は本アプリへ採用していない。原本は変更していない。

2026-10-13、imagegenスキルと組み込みのimage_gen.imagegenを使い、原本を参照して右側の精霊だけを透過画像として作成した。1024×1536のRGBA PNG。画像生成結果を確認し、コピー後に透過とサイズを確認。追加の画像加工は行っていない。案内の閉鎖・通常プレイでは表示しない。資材は版付きで配信・オフライン準備へ含める。

使用した指示：

```text
Edit target: the attached adopted character comparison image. Extract ONLY the humanoid star spirit on the RIGHT (option 2) as a clean single game-guide character asset on a genuinely transparent background. Preserve the exact character identity and design faithfully: small floating humanoid, luminous silver-white wavy hair, simple warm gold oval eyes, tiny pale face, navy starry cape/cloak with delicate gold trim, chest star medallion, white translucent lower robe/feet, gold orbital line and small star over the head. Preserve original pose, expression, silhouette, colors, painterly illustration style and proportion. Remove ALL surrounding scenery, ruins, domes, sky, comparison divider, number 2, typography and the entire left option. Do not add scenery, objects, text, extra characters or redesign the character. Full figure with orbit and feet entirely visible, snug centered portrait composition, small transparent margin. This will appear at 44-64px tall in an actual guide; retain a clear recognizable silhouette and face.
```

## 舞台と光の表示

夜空の浮遊遺跡はQ1～3、ドーム型天文台はQ4～6に対応する。src/ui/scene.jsの図形描画で、窓の向きと大きさに合わせて背景を表示する。自由モードは両方を控えめに表示する実装上の具体案。背景・星座は入力の対象や実験の出来事にしない。出発点・プリズム・祭壇の図形は操作対象の上に描く。

一到着につき光の粒と星座を1300ms表示する値は、実装時の調整値。実験の時計へ加算せず、同時到着の別々の粒・到着数・記録を保持する。停止や別の実験では古い演出を消す。外観の細部が利用者によって新たに承認されたという意味ではない。
