# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** 気軽にかずみんに会いに行ける予約体験 — 堅苦しいビジネスミーティングの予約ではなく、「かずみん、時間空いてる?」と友だちに声をかける感覚でセッションを予約できること。
**Current focus:** Phase 3 - ゲスト予約体験

## Current Position

Phase: 3 of 6 (ゲスト予約体験)
Plan: 0 of 2 in current phase
Status: Ready to plan
Last activity: 2026-02-22 — Phase 2 完了（認証基盤、予約作成Saga、予約一覧・キャンセル）

Progress: [████░░░░░░] 33% (2/6 phases complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: ~10 min
- Total execution time: ~50 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 1 | 2/2 | ~30min | ~15min |
| Phase 2 | 3/3 | ~20min | ~7min |

**Recent Trend:**
- Last 5 plans: 01-01 ✓, 01-02 ✓, 02-01 ✓, 02-02 ✓, 02-03 ✓
- Trend: Accelerating (infrastructure + automation)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Supabase選択: PostgreSQLトランザクション整合性でポイント管理を担保、Auth+Edge Functions統合
- ポイント残高をmember_plansに直接保持: 残高取得を1クエリで完結(KISS原則)
- Next.js 15.3.3を使用: Next.js 16のTurbopackは日本語パス名でバグ発生
- 招待制チェック: profilesテーブル存在確認で未招待ユーザーをブロック

### Phase 2 Implementation Summary

**認証基盤 (02-01):**
- Supabaseクライアント3パターン: client.ts, server.ts, middleware.ts
- Google OAuth + メール/パスワード認証
- 招待制チェック（profilesテーブル存在確認）
- ミドルウェアによる保護ページガード

**予約作成 (02-02):**
- Sagaオーケストレーター（8ステップ、補償トランザクション付き）
- 冪等性キー管理（idempotency_keysテーブル）
- モック外部API（Zoom, Google Calendar, Email）
- 予約フローUI（メニュー選択→スロット選択→確認→完了）
- ポイント残高表示（ヘッダー+ダッシュボード）

**予約一覧・キャンセル (02-03):**
- 「今後」「過去」タブ切り替え
- 予約詳細ページ（キャンセルボタン付き）
- キャンセル時のポイント返還（refund_points RPC）

### Pending Todos

None yet.

### Blockers/Concerns

**Phase 1 Critical Risks: ✅ 解決済み**
- ポイント二重消費リスク: ✅ SELECT FOR UPDATE NOWAITをconsume_points()に実装
- 二重予約リスク: ✅ EXCLUDE制約 + btree_gistで時間範囲重複を自動防止
- RLSパフォーマンス: ✅ JWT claimをSELECTでラップしてキャッシュ化

**Phase 2 Critical Risks: ✅ 解決済み**
- Sagaパターン: ✅ 8ステップの補償トランザクション実装
- 冪等性: ✅ idempotency_keysテーブルで二重予約防止

**Phase 3-6 Critical Risks:**
- OAuth期限切れ: リフレッシュトークン自動更新フローの実装必須 (Phase 4)
- Google Calendar Rate Limit: 排他制御実装必須 (Phase 4)
- ゲストレート制限: 悪意あるアクセス防止 (Phase 3)

## Session Continuity

Last session: 2026-02-22
Stopped at: Phase 2 execution completed
Resume file: None
