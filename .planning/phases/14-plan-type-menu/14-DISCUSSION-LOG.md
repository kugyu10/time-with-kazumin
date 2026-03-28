# Phase 14: プランタイプ別メニュー表示 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 14-plan-type-menu
**Areas discussed:** メニューフィルタリング方式, 管理画面UI, ゲスト予約への影響

---

## メニューフィルタリング方式

| Option | Description | Selected |
|--------|-------------|----------|
| アプリ層フィルタ | bookings/new/page.tsxで会員のplan_type_idを取得し、取得後にフィルタ。RLSポリシー変更不要で安全 | ✓ |
| APIエンドポイントでフィルタ | 新規/既存APIでサーバー側フィルタ。クライアントコードがシンプルになるが変更箇所が増える | |

**User's choice:** アプリ層フィルタ（既定方針）

| Option | Description | Selected |
|--------|-------------|----------|
| bookings/newで直接取得 | bookings/new/page.tsx内でmember_plansをクエリしてplan_type_idを取得。局所的でシンプル | ✓ |
| layoutからpropsで渡す | layout.tsxのmember_plans取得を拡張してplan_type_idも取得、子コンポーネントに渡す。共有だが複雑 | |

**User's choice:** bookings/newで直接取得（推奨）

---

## 管理画面UI

| Option | Description | Selected |
|--------|-------------|----------|
| チェックボックス | 各プランタイプをチェックボックスで複数選択。未選択=全プラン表示。shadcn/ui Checkboxをそのまま使える | ✓ |
| マルチセレクト | ドロップダウンで複数選択。プランが増えた時にスケールするが、2種類には過剰 | |
| おまかせ | Claudeの判断に任せる | |

**User's choice:** チェックボックス（推奨）

---

## ゲスト予約への影響

| Option | Description | Selected |
|--------|-------------|----------|
| 変更なし | ゲスト予約画面は別パス（/guest/booking）でメニュー選択なしの30分固定。Phase 14のフィルタは会員予約画面のみに影響 | ✓ |
| ゲストにもフィルタ適用 | ゲスト用メニューもallowed_plan_typesで制御。スコープが広がる | |

**User's choice:** 変更なし（推奨）
**Notes:** 将来ゲストでも1時間/2時間予約できるようにしたいが、そのたびに別パスで対応するつもり（Deferred Ideasに記録）

---

## Claude's Discretion

- チェックボックスUIの具体的なレイアウト
- プランタイプ一覧の取得方法
- bookings/confirm/page.tsxでのフィルタ適用要否

## Deferred Ideas

- ゲスト予約で1時間/2時間セッションを予約可能にする — 将来フェーズで別パス対応
- プランタイプの自動切り替え（有効期限ベース） — v2
