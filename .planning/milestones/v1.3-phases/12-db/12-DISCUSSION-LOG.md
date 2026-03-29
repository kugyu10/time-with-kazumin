# Phase 12: DBスキーマ基盤 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-03-27
**Phase:** 12-db
**Mode:** discuss
**Areas analyzed:** メニューとプランの紐付け方式, お金のブロック解消プランの詳細, 管理画面UIの範囲

## Discussion Summary

### メニューとプランの紐付け方式
- **Q:** 配列カラム vs 中間テーブル？
- **A:** 配列カラム（allowed_plan_types INTEGER[] DEFAULT NULL）を採用。プランタイプは2〜3種類で安定するため、中間テーブルは過剰。

### お金のブロック解消プランの詳細
- **プラン名:** お金のブロック解消プラン
- **monthly_points:** 120
- **max_points:** 240
- **price_monthly:** 50000
- **専用メニュー:** 60分お金のブロック解消セッション — 60Pt消費
- ※当初60Pt/max120Ptで回答→ユーザーが120Pt/max240Ptに修正

### 管理画面UIの範囲
- **決定:** Phase 12はDBマイグレーション + seedデータのみ。管理画面UIはPhase 14。

## Open Items
- お金のブロック解消セッションの zoom_account（A or B）が未確定
