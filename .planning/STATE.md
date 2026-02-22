# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** 気軽にかずみんに会いに行ける予約体験 — 堅苦しいビジネスミーティングの予約ではなく、「かずみん、時間空いてる?」と友だちに声をかける感覚でセッションを予約できること。
**Current focus:** Phase 2 - 認証と予約コア

## Current Position

Phase: 2 of 6 (認証と予約コア)
Plan: 3 of 3 in current phase
Status: In progress
Last activity: 2026-02-22 — Plan 02-03 完了（予約一覧・詳細・キャンセル機能）

Progress: [████░░░░░░] 40% (1/6 phases, 3/3 plans in phase 2)

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: ~15 min
- Total execution time: ~1.5 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 1 | 2/2 | ~1h | ~30min |
| Phase 2 | 3/3 | ~30min | ~10min |

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

### Pending Todos

None yet.

### Blockers/Concerns

**Phase 1 Critical Risks: ✅ 解決済み**
- ポイント二重消費リスク: ✅ SELECT FOR UPDATE NOWAITをconsume_points()に実装
- 二重予約リスク: ✅ EXCLUDE制約 + btree_gistで時間範囲重複を自動防止
- RLSパフォーマンス: ✅ JWT claimをSELECTでラップしてキャッシュ化

**Phase 2-4 Critical Risks:**
- 分散トランザクション: Sagaパターン設計が外部API統合前に完了必須
- OAuth期限切れ: リフレッシュトークン自動更新フローの実装必須
- Google Calendar Rate Limit: 排他制御実装必須

## Session Continuity

Last session: 2026-02-22
Stopped at: Completed 02-03-PLAN.md (予約一覧・詳細・キャンセル機能)
Resume file: None
