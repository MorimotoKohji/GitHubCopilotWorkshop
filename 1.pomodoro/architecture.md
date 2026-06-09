# ポモドーロタイマー Web アプリケーション アーキテクチャ

## 技術スタック

| レイヤー | 技術 |
|---|---|
| バックエンド | Python / Flask |
| フロントエンド | HTML / CSS / JavaScript（フレームワークなし） |
| データ永続化 | JSON ファイル（`progress.json`） |
| テスト | pytest / pytest-flask |

---

## ファイル構成

```
1.pomodoro/
├── app.py                    # Application Factory（Flask ルート定義）
├── progress.py               # ビジネスロジック（進捗の読み書き）
├── requirements.txt          # 依存パッケージ
├── progress.json             # 実行時生成：今日の進捗データ
├── templates/
│   └── index.html            # メインUI（Jinja2 テンプレート）
├── static/
│   ├── css/
│   │   └── style.css         # スタイル（SVGリング・ボタン等）
│   └── js/
│       └── timer.js          # タイマーロジック・進捗取得
└── tests/
    ├── __init__.py
    ├── test_progress.py      # ビジネスロジック単体テスト
    └── test_routes.py        # API エンドポイントテスト
```

---

## レイヤー構成と責務

### バックエンド

#### `app.py` — Application Factory

- `create_app(config)` 関数でアプリインスタンスを生成する **Application Factory パターン** を採用。
- テスト時に `config` へ `DATA_FILE` などを注入できるため、環境ごとの設定切り替えが容易。
- ルート定義のみを持ち、ビジネスロジックは持たない。

```
GET  /              → index.html を返す
GET  /api/progress  → 今日の進捗を JSON で返す
POST /api/progress/add → セッション完了を記録し、更新後の進捗を返す
```

#### `progress.py` — ビジネスロジック

- ファイルパス（`data_file`）と日付（`today`）をすべて引数で受け取る設計。
- モジュールレベルの状態・グローバル変数に依存しない純粋関数で構成。
- テスト時は `tmp_path` を渡すだけでファイルI/Oを完全に分離できる。

| 関数 | 役割 |
|---|---|
| `load_progress(data_file, today)` | 進捗を読み込む。日付が異なる場合は初期値を返す |
| `save_progress(data_file, data)` | 進捗をJSONファイルに書き込む |
| `add_session(data_file, minutes, today)` | セッションを1件追加して保存・返却 |

#### データモデル（`progress.json`）

```json
{
  "date": "2026-06-09",
  "completed_sessions": 4,
  "total_focus_minutes": 100
}
```

- 日付が変わると自動的に初期値へリセットされる。

---

### フロントエンド

#### `timer.js` — タイマーロジック

タイマーの状態遷移をクライアント側のみで管理し、サーバーへの通信は最小限に抑える。

```
IDLE ──[開始]──▶ RUNNING ──[一時停止]──▶ PAUSED
                    │                        │
                    │         [再開]◀────────┘
                    │
               [25分経過]
                    │
                    ▼
               COMPLETED ──[/api/progress/add を呼び出し]──▶ IDLE
```

- `setInterval` による1秒ごとのカウントダウン。
- セッション完了時のみ `POST /api/progress/add` を呼び出す。
- ページ読み込み時に `GET /api/progress` で今日の進捗を取得・表示。

#### `style.css` — SVGリング

- 残り時間に応じた円形プログレスバーを SVG の `stroke-dashoffset` で描画。
- 外部 CSS フレームワークは使用せず、モックに忠実なデザインをスクラッチで実装。

---

## テスト方針

### 単体テスト（`test_progress.py`）

`progress.py` の各関数を `tmp_path` フィクスチャと `today` 引数の注入でテスト。

| テストケース | 観点 |
|---|---|
| ファイルが存在しない場合に初期値を返す | 初回起動 |
| 既存データを正しく読み込む | 通常動作 |
| 日付が変わると初期値にリセットされる | 日付境界 |
| セッションが累積される | 加算動作 |
| ファイルに永続化される | I/O確認 |

### APIテスト（`test_routes.py`）

`create_app({"TESTING": True, "DATA_FILE": tmp_path})` でテスト用アプリを生成し、Flask の `test_client()` で HTTP レベルの検証を行う。

---

## テスト実行

```bash
cd 1.pomodoro
python -m pytest tests/ -v
```

---

## 起動方法

```bash
cd 1.pomodoro
pip install -r requirements.txt
python app.py
# → http://127.0.0.1:5000
```
