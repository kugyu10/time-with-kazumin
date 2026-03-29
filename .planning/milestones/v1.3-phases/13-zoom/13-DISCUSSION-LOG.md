# Phase 13: Zoomカレンダーブロック - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 13-zoom
**Areas discussed:** Zoom API統合方式, 空き枠判定への組み込み方, キャッシュ戦略, エラー3161フォールバック

---

## Zoom API統合方式

| Option | Description | Selected |
|--------|-------------|----------|
| 既存zoom.tsに追加 | getZoomScheduledMeetings()をzoom.tsに追加。トークン取得やエラーハンドリングを再利用できる | ✓ |
| 新規zoom-schedule.tsを作成 | 会議作成とスケジュール取得を分離。ファイルが増えるが責務が明確 | |

**User's choice:** 既存zoom.tsに追加（推奨）

| Option | Description | Selected |
|--------|-------------|----------|
| Promise.allSettled並列 | AとBを同時取得。片方が失敗してももう片方の結果は使える。レスポンス時間短縮 | ✓ |
| 順次取得 | A→Bの順で取得。シンプルだが取得に時間がかかる | |

**User's choice:** Promise.allSettled並列（推奨）

---

## 空き枠判定への組み込み方

| Option | Description | Selected |
|--------|-------------|----------|
| busyTimesに合流 | ZoomのbusyTimesをGoogle CalendarのbusyTimesにマージして既存のisSlotBusy()をそのまま使う。変更箇所最小 | ✓ |
| 別レイヤーで判定 | isSlotZoomBusy()を新設して、available判定で別途チェック。分離はできるが判定ロジックが分散 | |
| おまかせ | Claudeの判断に任せる | |

**User's choice:** busyTimesに合流（推奨）

| Option | Description | Selected |
|--------|-------------|----------|
| saga.tsのフローに追加 | Zoom会議作成前にスケジュール確認ステップを追加。競合時はZoom会議作成をスキップしてエラー返却 | ✓ |
| slots API側で制御 | スロット表示時にリアルタイム確認。saga.tsは変更なし | |
| おまかせ | Claudeの判断に任せる | |

**User's choice:** saga.tsのフローに追加（推奨）

---

## キャッシュ戦略

| Option | Description | Selected |
|--------|-------------|----------|
| LRUCache同一パターン | Google Calendarと同じLRUCache 15分TTL。既存パターン踏襲で一貫性あり。予約確定時はキャッシュバイパス | ✓ |
| おまかせ | Claudeの判断に任せる | |

**User's choice:** LRUCache同一パターン（推奨）

---

## エラー3161フォールバック

| Option | Description | Selected |
|--------|-------------|----------|
| 空配列 + warnログ | ZOOM_Bが3161を返したら空配列を返却しconsole.warnで記録。予約は止まらない（ZOOM_Bのブロックなしで動作） | ✓ |
| 空配列 + 管理者通知 | 上記に加えて、管理者ダッシュボードに警告表示。スコープは広がるが問題の可視化ができる | |

**User's choice:** 空配列 + warnログ（既定方針）

| Option | Description | Selected |
|--------|-------------|----------|
| 先に実装、後で確認 | エラー3161フォールバックを実装済みにしておき、デプロイ後に実際の挙動を確認。実装がブロックされない | ✓ |
| 先にcurlで確認 | ZOOM_Bの実際のエラーレスポンスを確認してから実装。確実だが開発がブロックされる | |

**User's choice:** 先に実装、後で確認

---

## Claude's Discretion

- Zoom APIレスポンスの型定義の詳細
- busyTimesマージの具体的な実装方法
- saga.tsへの追加ステップの具体的な位置
- Zoomスケジュール取得のページネーション処理

## Deferred Ideas

None — discussion stayed within phase scope
