# 0.90.0 終了表示・鏡の回転盤

- `before/chromium/report.json`：0.89.0のQ25出題5。旧基準では編集復帰の待機があり合格になるが、カードは最後の鐘とほぼ同時。現在の合格判定ではない。
- `red/chromium/report.json`：同じ旧版を「光終了からカードまで待つ」基準で再検査し、不合格を再現した記録。
- `after/chromium-draw5/` は最初の修正での再現確認。`all42/chromium/` は最初の通し検査で、14面を選ぶ検査側の1秒上限で中断した記録。いずれも最終の全42面合格記録とは分ける。
- `final/chromium/report.json`：出題1系統、全42面と部分点・不成立の47ケース。
- `final/webkit/report.json`：出題5系統の全42面47ケース。最初の実行と、新しいブラウザで再実行した31〜42面を出典付きで統合。
- `initial-webkit-load-timeout.json`：初回WebKitのページ読込待ち10秒超過。34面は実行開始前で、合格に含めない。
- `final/webkit-tail/report.json`：上記の31〜42面を再実行し、鏡の外観変更後の面も確認した記録。
- `edges/{chromium,webkit}/report.json`：上限、到達不能、次動作、手動停止、PC花火、控えめな演出、結果後の選択操作の各7ケース。
- `verification.json`：最終ブラウザ検査の集計。`followups.json` は直列に実施したジョブの終了コード。
- `tests.log`：全41テストファイル。`syntax.log`：112ファイル。`build.log`：78資材。

鏡の操作検査・実画面は `../鏡のホイール/0.90.0/local/` の両ブラウザを参照する。物理端末の操作・音質の合格とは区別する。スクリーンショットの一部はローカルにのみ保存し、主要な確認画像をGitへ記録する。
