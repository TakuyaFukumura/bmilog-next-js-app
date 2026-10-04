# BMI・体重ログ

Next.jsで作成した、匿名サンプルCSVから体重の推移とBMIを確認するWebアプリです。認証や画面からの記録入力はなく、データはCSVを直接編集して更新します。

## 機能

- 最新体重・BMI・目標体重との差分を表示
- 全期間、1か月、3か月、6か月の体重推移グラフ
- BMI標準範囲と目標体重の基準線を表示
- 記録点の選択、100件ずつの記録表、キーボード操作
- CSVの形式・値を検証し、エラー時は行番号と理由を表示
- ライト／ダークテーマ、レスポンシブ表示

BMI区分は成人向けの目安であり、健康状態の診断を行うものではありません。

## データ

開発環境・本番環境とも、次の匿名サンプルCSVを読み込みます。CSVは各ページリクエスト時に読み直します。

- `data/weight-sample.csv`: `date,weight_kg` のヘッダーと測定記録
- `data/profile-sample.csv`: `height_cm,target_weight_kg` のヘッダーとプロフィール1行

値の形式や許容範囲は[要件定義書](docs/要件定義書.md)を参照してください。サンプルCSVはGit管理対象です。実データ用の `data/weight.csv` と `data/profile.csv` を置く場合はGit管理されません。また、この初期版では実データ用CSVは読み込みません。

## 開発

Node.js 26.x以上とnpmを使用します。

```bash
npm install
npm run dev
```

ブラウザーで <http://localhost:3000> を開きます。

```bash
npm test
npm run lint
npm run build
```

## 技術スタック

- Next.js App Router、React、TypeScript
- Tailwind CSS
- Recharts
- csv-parse
- Jest、React Testing Library

## ディレクトリ構成

```text
data/                    匿名サンプルCSV
docs/                    要件定義書・設計書・実装計画書
src/app/                 ページ、共通レイアウト、画面コンポーネント
src/lib/                 CSV検証、BMI・期間計算、データ取得
__tests__/               単体・コンポーネントテスト
```
