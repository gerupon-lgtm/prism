# Tutorial Discovery Implementation Plan

> Agentic workers: follow the authorized design task by task; root owns integration and release. User approved implementation on 2026-11-06, so do not request another phase approval.

**Goal:** 操作と試行錯誤を理解し、自分の回路で三つのFM鐘が響くチュートリアル。

**Architecture:** Sessionだけが練習の進行と元状態の控えを管理。練習用固定回路を独立させ、本番の42面288出題を変更しない。表示側はSessionを参照して短文・操作のお手本・比較結果を描く。

**Tech Stack:** 既存JavaScript、SVG/CSS、Web Audio、Node test、Playwright。新規依存なし。

**Spec:** [設計](../../proposals/2026-11-06-tutorial-discovery.md)

## Global Constraints

練習前の状態の復元、成績非記録、自由練習、保存失敗の再試行、控えめ演出、短画面の全文入口を維持。音色と通常面の時計/採点/結果待機を変更しない。表示/読込版を0.102.0へ更新。

## Review Focus

- 説明と違う道を選んだ時、強制的な巻き戻しや行き止まりを作らない。
- 途中停止や前の実行の記録を現在段階の達成へ使わない。
- クリア前の記録、ダイアログ、非表示、サイズ変更で演出予約が残らない。
- 文字拡大・横置き・小画面でもパーツと経路を隠さない。
- 三つの鐘の実到達・音程と、比較回路の時間/点数を混同しない。

## Tasks

- [x] **State and circuits** — `src/content/tutorial.js`を新設し、`src/app/session.js`と`tests/session.test.js`へ練習専用rev2の進行を実装。challenge step0初回実到達、1削除、2別経路実到達、3記録、4章移動ボタン、5分岐実行、readyToFinish。`Session.nextGuideLesson()`はstep4かつ編集可能時のみ分岐練習へ移る。`guide.firstResult/comparison`は実結果の複製。自由step0..3を維持。進行/誤操作/クリア/スキップ/失敗を単体で点検。
- [x] **Guide presentation** — `tutorialContent(session,coarse)`を目的・操作・補足・対象・お手本区間へ拡張。`TutorialGuide`は実盤面座標を使う非操作SVGのお手本、段階の反応、操作中/非表示の取消を所有。`app.js/index.html/tutorial.css/desktop.css`に見出し・進度・補足・次章ボタンを統合。実行中は見守る案内、終了画面は比較と三音の達成を表示。
- [x] **Verification** — 新しい実操作検査で2章を完走し、前後の実時間と音程、削除/回復、通常/控えめ、複数サイズ、元状態復元を検査。自由の既存検査も維持。関連単体、全テスト、構文、版比較、ビルドを実施。スクリーンショットと動きの素材を確認し独立レビューを受ける。
- [ ] **Release and evidence** — AGENTS/点検資料を同期し、変更ファイルだけをcommit/push。両公開先の版・資材・実画面を確認。実機の伝わり方/指操作/聴感はPC検査と区別して報告。
