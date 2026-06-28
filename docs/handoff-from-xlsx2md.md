# miku-md2xlsx 申し送り

作成日: 2026-05-17

## 位置づけ

`miku-md2xlsx` は、Markdown から実用的な Excel (`.xlsx`) Workbook を生成する miku-soft main application として扱う。

`miku-xlsx2md` の完全な逆変換ツールではない。`miku-xlsx2md` は Excel Workbook から、生成 AI や人間が読みやすい Markdown 向け成果物を抽出するツールであり、Excel の見た目を完全再現することを目的にしていない。そのため、`xlsx -> md -> xlsx` の完全な round trip は非目標とする。

このプロジェクトの自然な価値は、Markdown を起点に、配布・確認・編集しやすい Excel Workbook を生成することにある。

## 参照元プロジェクト

- `miku-xlsx2md`
  - Excel Workbook から Markdown-oriented artifacts を抽出する main application。
  - 変換思想は「見た目の忠実再現」ではなく「構造と意味の保存」。
  - `miku-md2xlsx` は、この思想を反対方向へ適用するが、実装やデータモデルは別物として設計する。
- `miku-md2docx`
  - Markdown から Office 文書を生成する姉妹プロジェクト。
  - CLI 形状、Markdown 入力の扱い、出力ファイル指定、将来の Web 分離方針の参考にする。

## 非目標

- `miku-xlsx2md` 出力から元 Excel を完全復元すること。
- 元 Workbook のセル番地、列幅、行高、結合セル、条件付き書式、テーマ、詳細スタイルを復元すること。
- Excel 数式、cached value、外部参照、構造化参照を完全再構成すること。
- chart / shape / drawing / SmartArt を完全再構築すること。
- カレンダー、プランナー、帳票風シートのピクセル単位レイアウトを再現すること。

## 初期スコープ

初期版は、Markdown の情報構造を素直な Excel Workbook へ変換することに集中する。

- Markdown 見出しから sheet または section を生成する。
- Markdown table を Excel の表領域として生成する。
- 段落、箇条書き、番号付きリストをセル行として配置する。
- code block は等幅文字のテキスト領域として扱う。
- horizontal rule は区切り行として扱う。
- 画像は、ローカル assets 参照を検出できる場合に限って将来対応候補とする。
- 既定では、読みやすい列幅、ヘッダ行の強調、罫線、折り返し程度の最小スタイルを付ける。

## Markdown から Excel への基本方針

Excel は Markdown よりレイアウト自由度が高いが、初期版では自由配置を追いすぎない。

- Markdown document を上から順に走査する。
- `#` 見出しは Workbook 全体のタイトルまたは sheet 分割の候補にする。
- `##` 見出しは sheet 分割または sheet 内 section の候補にする。
- 表はセルの 2 次元構造として最優先で保持する。
- 本文系 block は 1 行 1 block を基本とし、必要に応じて複数列に展開する。
- Markdown の見た目より、Excel 上で再編集しやすい構造を優先する。

## 推奨する初期 CLI

最小 CLI は次の形でよい。

```bash
npm run cli -- input.md --out output.xlsx
```

候補オプション:

- `--out <file>`: 出力 `.xlsx` パス。
- `--sheet-mode <mode>`: `single` または `heading`。
- `--title <value>`: Workbook または先頭 sheet の表示名補助。
- `--table-style <mode>`: `plain` または `bordered`。
- `--no-header-row`: Markdown table の先頭行をヘッダ扱いしない。

初期段階ではオプションを増やしすぎず、実データで必要になったものから追加する。

## 実装方針

- TypeScript / Node.js main application として開始する。
- product core と CLI を同じリポジトリで持つ。
- Web App surface は必要になった時点で `miku-md2xlsx-web` として分離する。
- `.xlsx` 生成は既存ライブラリの利用を優先する。
- Markdown parser は既存ライブラリを利用し、独自正規表現 parser を主実装にしない。
- 変換 core は `Markdown AST -> workbook model -> xlsx writer` の段階に分ける。
- fixture ベースの回帰テストを早い段階で置く。

## 変換モデル案

内部モデルは Excel writer の API に直結させず、薄い workbook model を挟むと保守しやすい。

```text
Markdown file
  -> Markdown AST
  -> Document blocks
  -> Workbook model
  -> .xlsx binary
```

最小モデル候補:

- `WorkbookModel`
  - `sheets`
- `SheetModel`
  - `name`
  - `rows`
  - `columnHints`
- `RowModel`
  - `cells`
  - `kind`
- `CellModel`
  - `value`
  - `styleRole`
  - `colSpan` optional

`colSpan` は将来の結合セル候補として保持してもよいが、初期版で無理に結合セルへ変換しなくてよい。

## テスト観点

- 単一 Markdown table を 1 sheet の Excel にできる。
- 複数 table と段落が順序を保って Excel に出る。
- 見出しから sheet 分割できる。
- 日本語 Markdown を壊さず出力できる。
- 空セル、pipe escape、改行を含む table cell を扱える。
- 出力 `.xlsx` を再読込して、期待する sheet / cell 値を検証できる。

## README に最初に書くべきこと

README では、最初から次を明記する。

- `miku-md2xlsx` は Markdown から実用的な Excel Workbook を生成するツールである。
- `miku-xlsx2md` の完全逆変換ではない。
- 目的は「Markdown の情報構造を Excel で扱いやすくすること」である。
- 初期版の対象は見出し、本文、リスト、Markdown table である。

## 現在の実装状況

2026-05-17 時点で、初期 vertical slice は実装済み。

- README / package metadata / TypeScript source / CLI / fixture test layout を作成済み。
- Markdown parser は `remark-parse` + `remark-gfm` を使用。
- `.xlsx` writer は最小 OOXML package writer として実装済み。
- `Markdown AST -> WorkbookModel -> .xlsx` の段階構成を採用済み。
- `single table -> xlsx` と `heading split -> multiple sheets` を実装済み。
- `--sheet-mode heading` は既定で `#` を sheet split に使う。
- `--sheet-heading-depth 2` により、`miku-xlsx2md` 生成 Markdown の `# Book` / `## Sheet` 形式にも対応。
- local relative image assets は CLI で best-effort に収集し、`.xlsx` の `xl/media/` に埋め込む。
- Markdown image reference は semantic traceability のため workbook text としても残す。
- 画像 preview は小さめの固定 anchor と予約空行で、後続行との重なりを避ける。
- CLI/runtime bundle scripts と GitHub Release asset workflow を追加済み。
- GitHub Release CLI/runtime bundle workflow は、GitHub Release published
  起動で CLI bundle / runtime bundle / source bundle を生成・検証・添付する。
- `workbook-model` は thin entrypoint とし、Markdown block conversion,
  table compatibility repair, sheet building, column hint calculation を
  focused modules に分離済み。
- `xlsx-writer` は package assembly に集中し、XML primitives, styles,
  worksheet XML, drawing/image handling を focused modules に分離済み。
- paragraph/list/code など text-heavy row の A 列幅 hint は広めにし、
  sample workbook で過度な折り返しを抑える。

## 互換 fixture

`miku-xlsx2md` 由来 Markdown 互換 fixture は `tests/fixtures/from-xlsx2md/` に置く。

現在の主な coverage:

- basic workbook Markdown
- adjacent table Markdown
- Markdown escape-heavy table cells
- narrative paragraphs and tables
- hyperlinks
- merge multiline markers
- rich text Markdown output
- local image assets
- image and chart coexistence Markdown

fixture 更新は次で行う。

```bash
npm run fixtures:from-xlsx2md
```

通常テストは `workplace/` に依存しない。fixture 再生成だけが `workplace/miku-xlsx2md` に依存する。

## 検証コマンド

主要な確認コマンド:

```bash
npm run fixtures:from-xlsx2md
npm run test
npm run build:all
npm run smoke:bundle
npm run smoke:runtime
git diff --check
```

`bundle/` と `dist/` は生成物であり `.gitignore` 対象。

## 次の一手

1. user-provided real Markdown documents で block coverage を増やす。
2. 実画像サンプルが増えたら image sizing controls を検討する。
3. 次回 GitHub Release 公開時に release asset の中身を確認する。
