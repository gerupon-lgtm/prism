# 配線の方向表示・採用イメージ

2026-10-19、発案者が「これで行きましょう！」と選んだ画像を`approved.png`へ保存した。元はQ10の実機スクリーンショットに、組み込みimage_genの編集モードで方向表示を追加した画像。長い線は途中と終点手前、短い線は1つとする。D→Cの破線がC方向へ進むことを示す。

生成画像の画素や数値をそのままゲームへ貼らず、実際の曲線・パーツ・文字・空きに合わせてSVGで描く。経路と数値は採用イメージの再描画から取り出さず、アプリの正典を保つ。作業の記録は[点検](../../docs/reviews/2026-10-19-edge-directions.md)。

## 最終の生成指示（組み込みimage_gen、編集モード）

Use case: precise-object-edit.
Edit target: the provided PRISM NOTES game screenshot mockup with arrowheads. Preserve all text, every UI element, all original line paths and colors, node artwork, node locations, time cards, background, and the tall portrait composition.
Requested revision: show the agreed "middle + near destination" direction indicators. On each LONG path show TWO small arrowheads: one around the middle (adjust slightly to avoid any time card), one near the destination, outside the part artwork. On a SHORT path, keep just ONE arrowhead so markers never collide. Both markers must always follow that path's tangent in the SAME direction. Maintain clear empty space around cards and prisms.
Most crucial specific change: the dashed D-to-C line running diagonally from left-upper D toward right-lower C currently has only one marker in its middle. Replace it with TWO matching small pale blue-gray chevrons, one at about 35-45% and the other at about 80-85% of the exposed segment, BOTH pointing DOWN-RIGHT TOWARD C. Do NOT show an arrow pointing to D. Neither marker may touch the prism C or its name.
Use refined slender arrowheads, about 20% smaller than the current broad arrowheads. Simple two-stroke open chevrons or delicate narrow heads, not bulky spearheads, not three-dimensional large arrows. For candidates use muted pale blue-gray; for connected paths use pale gold. At normal mobile display size directions should still be easy to recognize.
The four connected paths are star→A, A→C, C→bell 2, C→bell 3. Other candidate directions are A→B, B→D, D→bell 1, D→bell 2, A→D, B→bell 1, D→C. Never reverse them. Long A→C and the longer bell paths should also clearly use two spaced direction heads where cards leave room. Short star→A and B→D need only one.
Change ONLY direction markers. No new labels, extra symbols, callouts, highlighting, extra line paths, or changes to Japanese writing. Keep the quiet indigo/gold fantasy atmosphere.
