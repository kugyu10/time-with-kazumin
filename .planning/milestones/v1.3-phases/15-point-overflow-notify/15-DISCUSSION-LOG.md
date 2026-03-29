# Phase 15: ポイント溢れ通知メール - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-29
**Phase:** 15-point-overflow-notify
**Areas discussed:** メール文面・トーン, 溢れ判定ロジック, 管理画面での確認方法

---

## メール文面・トーン

| Option | Description | Selected |
|--------|-------------|----------|
| やさしいリマインダー | 友だち感覚で伝える。ブランドの温かさを反映 | ✓ |
| 事務的な通知 | 簡潔に情報を伝える。情報重視 | |
| おまかせ | Claudeの判断 | |

**User's choice:** やさしいリマインダー（推奨）

| Option | Description | Selected |
|--------|-------------|----------|
| 予約ページへのリンク付き | 「今すぐ予約する」ボタンで予約画面へ誘導。ポイント消化を促進 | ✓ |
| 情報のみ（リンクなし） | ポイント状況の通知のみ。予約への誘導はしない | |

**User's choice:** 予約ページへのリンク付き（推奨）

---

## 溢れ判定ロジック

| Option | Description | Selected |
|--------|-------------|----------|
| 単純判定 | current_points + monthly_points > max_points で判定。予約済みポイントは考慮しない。シンプルで確実 | ✓ |
| 予約済み考慮 | current_points - 予約済み消費予定 + monthly_points > max_points。より正確だが複雑 | |

**User's choice:** 単純判定（推奨）

---

## 管理画面での確認方法

| Option | Description | Selected |
|--------|-------------|----------|
| 既存tasks画面拡張 | TaskName型に "point_overflow_notify" を追加し、既存のフィルタ・UIをそのまま利用。変更最小 | ✓ |
| 専用ビュー新設 | ポイント溢れ通知専用のダッシュボードビュー。詳細が見やすいが変更が大きい | |

**User's choice:** 既存tasks画面拡張（推奨）

---

## Claude's Discretion

- React Emailテンプレートのレイアウト・スタイリング
- Edge Functionのリトライ回数・タイミング
- 溢れ対象会員取得クエリの構文
- メール件名の文言

## Deferred Ideas

None — discussion stayed within phase scope
