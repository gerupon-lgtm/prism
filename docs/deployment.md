# プリズム・ノーツの配信

## 配信先

- MVP用：`https://prism.sikumilab.com/`
- Cloudflare Pagesプロジェクト：`prism-notes`、標準URL：`https://prism-notes.pages.dev/`
- 従来の確認先：`https://gerupon-lgtm.github.io/prism/`

2026-10-18、0.56.0を独自ドメインと従来URLで公開・確認済み。指のずれで反応しない削除確認と操作音・重複クリックの修正、版・全資材・更新・操作・保存・通信なし再起動の証拠は[公開点検](reviews/2026-10-18-touch-delete-confirmation.md)を参照する。0.51.0の図解付き説明と配線を消す練習も維持する。0.50.0の演出設定、0.49.0のR2到達音、0.48.0の案内配置と0.47.0のオフライン修正も維持する。

## 自動配信

`gerupon-lgtm/prism`のmainへの配信対象変更でGitHub Pagesへ自動配信する。Cloudflareもmainを配信する設定だが、自動起動と今回の実行結果は下記のとおり区別する。CloudflareはNode 24、ビルド命令は`npm run check && npm test && npm run build`、出力先は`dist`。プレビュー配信は無効。

Cloudflareの自動配信設定は有効だが、今回のpushだけでは配信作成を確認できなかったため、0.46.0・0.47.0・0.48.0・0.49.0・0.50.0・0.51.0・0.52.0・0.53.0・0.54.0・0.55.0・0.56.0はmainを指定してPages APIから開始した。GitHub側の自動配信は成功を確認済み。Cloudflareのpushによる自動起動は後続確認として残し、設定済みという事実と動作確認済みを区別する。

Cloudflareが未起動の場合は、対象コミットの配信が存在しないことを確認してから`POST /accounts/{account_id}/pages/projects/prism-notes/deployments`へmultipartの`branch=main`を送る。応答のコミットが対象と一致すること、ビルドと配信の成功、独自ドメインの実資材と動作を確認する。二重に同じ配信を作らない。

Cloudflareの対象は`src/*`、`public/*`、`index.html`、`package.json`、`scripts/*`、`画面案/ロゴ/fonts/*`。資料・検証結果だけの更新で同じ版を再配信しない。GitHub側は`.github/workflows/pages.yml`で検査・版比較・テスト・ビルドを行う。

毎回package.json、index.htmlの表示版と読込版をそろえて上げる。ビルドは版ごとの資材ディレクトリ、全資材のハッシュ、Worker、アプリ情報を生成する。配信元のコミットはGitHubの`GITHUB_SHA`またはCloudflareの`CF_PAGES_COMMIT_SHA`を記録する。

生成する`_headers`によりHTML・manifestは再確認、版情報とWorkerは保存しない、版付き資材は長期保存とする。オフライン用の全資材準備と既存の安全な更新適用処理は別に維持する。

## 独自ドメインと旧URL

Cloudflare側だけで`prism.sikumilab.com`を`prism-notes.pages.dev`へ接続する。GitHubリポジトリへCNAMEを追加したり、GitHub Pagesの独自ドメインを変更したりしない。旧URLは継続利用できる。

ブラウザの保存場所はURLごとに独立する。成績・保存枠の新URLへの自動移行は未実装。旧データは旧URLに残し、削除しない。自由回路は既存のJSONファイル書出し／読込みで持ち運べる。

## 公開後の確認

配信ジョブの成功だけでは公開確認の完了としない。`設計検証/check_public.cjs --url <公開URL> --commit <配信コミット> --playwright-path <既存Playwright>`で、HTTPS、版、全資材のハッシュと形式、Worker、実際の結線・採点・保存・書出しを確認する。結果は配信先のホスト名別に残す。Cloudflareではキャッシュ設定と独自ドメインの有効化も確認する。

PCの大画面は`check_desktop_layout.cjs --url <公開URL>`でも確認できる。PC上の検証をスマホ実機の合格には変更しない。復旧時も保存を削除せず、修正版の版番号を上げて配信する。
