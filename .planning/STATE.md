---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: 運用改善
status: verifying
stopped_at: Completed 16-member-activity-01-PLAN.md
last_updated: "2026-03-28T23:04:42.113Z"
last_activity: 2026-03-28
progress:
  total_phases: 5
  completed_phases: 4
  total_plans: 9
  completed_plans: 8
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-27)

**Core value:** 気軽にかずみんに会いに行ける予約体験
**Current focus:** Phase 13 — zoom

## Current Position

Milestone: v1.3 運用改善
Phase: 14
Plan: Not started
Status: Phase complete — ready for verification
Last activity: 2026-03-28

Progress: [          ] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 23 (v1.0〜v1.2)
- Average duration: ~7 min
- Total execution time: ~161 min

**v1.3 Phases (not started):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 12 | 0/TBD | - | - |
| Phase 13 | 0/TBD | - | - |
| Phase 14 | 0/TBD | - | - |
| Phase 15 | 0/TBD | - | - |
| Phase 16 | 0/TBD | - | - |

*Updated after each plan completion*
| Phase 12-db P01 | 13 | 2 tasks | 3 files |
| Phase 13-zoom P01 | 15 | 1 tasks | 2 files |
| Phase 13-zoom P02 | 8 | 2 tasks | 3 files |
| Phase 14-plan-type-menu P01 | 10 | 2 tasks | 5 files |
| Phase 14-plan-type-menu P02 | 12 | 2 tasks | 3 files |
| Phase 15-point-overflow-notify P01 | 10 | 2 tasks | 4 files |
| Phase 15-point-overflow-notify P02 | 8 | 1 tasks | 1 files |
| Phase 16-member-activity P01 | 15 | 2 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v1.3 Research]: `meeting_menus.allowed_plan_types INTEGER[] DEFAULT NULL` — NULLで全プラン表示（後方互換）
- [v1.3 Research]: アプリ層フィルタ採用（RLSポリシー変更なし）— 既存ポリシーとの競合回避
- [v1.3 Research]: ZoomアカウントBはエラー3161フォールバックを必ず実装（空配列返却 + ログ）
- [v1.3 Research]: pg_cronはUTC固定 — JST 20日09:00 = `0 0 20 * *`（UTC）
- [v1.3 Research]: `point-overflow-notify` Edge Functionは `monthly-point-grant` パターン踏襲
- [Phase 12-db]: allowed_plan_types INTEGER[] DEFAULT NULL — NULLで全プラン表示（後方互換）
- [Phase 12-db]: CTE INSERT ... RETURNING パターンで SERIAL id を取得してから参照設定
- [Phase 12-db]: GINパーシャルインデックス (WHERE IS NOT NULL) で NULL 行を除外し効率化
- [Phase 13-zoom]: getZoomScheduledMeetings はトークンキャッシュを使いつつスケジュールキャッシュをバイパスする（予約確定時のリアルタイム確認保証）
- [Phase 13-zoom]: getCachedZoomBusyTimes は15分TTL LRUCacheを使い通常のスロット表示フローに使用する
- [Phase 13-zoom]: getCachedZoomBusyTimes（15分TTL）をスロットAPI用に使用、getZoomScheduledMeetings（キャッシュバイパス）を予約確定時に使用
- [Phase 13-zoom]: Step 2.5はcompletedStepsに追加しない（読み取り専用ステップ、補償不要）
- [Phase 14-plan-type-menu P01]: 空配列→NULL変換をonSubmit内で行う（D-06: 未選択=全プラン表示）
- [Phase 14-plan-type-menu P01]: plans一覧はServer Component (page.tsx) でフェッチしClient Componentにprops経由で渡す
- [Phase 14-plan-type-menu]: filterMenusByPlanType はジェネリクスで allowed_plan_types を持つ任意型に適用可能、フィルタ後に除外して MenuSelect に渡す
- [Phase Phase 15-01]: CHECK 制約拡張は DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT パターン（PostgreSQL は直接変更不可）
- [Phase Phase 15-01]: pg_cron スケジュールは UTC 固定 0 0 20 * * (JST 20日 09:00)
- [Phase 15-02]: 冪等性を task_execution_logs ベースで実装 (D-09) — monthly-point-grant と異なり point_transactions ではなく task_execution_logs で当月 point_overflow_notify 完了を確認
- [Phase 15-02]: インライン HTML テンプレート — Deno 環境では React Email を使わず renderPointOverflowHtml 関数で生成 (check-reminder-emails パターン)
- [Phase 16-01]: 2段階クエリ+JS集計採用: Supabase JSの3段ネストJOINを避け、シンプルさとデバッグ容易性を優先
- [Phase 16-01]: calcActivityStatusをexport純粋関数としてmembers.tsに配置: テスト可能性とDRY原則を両立
- [Phase 16-01]: getFollowUpMembers()はgetMembers()を内部呼び出してフィルタ: DRY+YAGNI原則

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 13実装前: ZOOM_B（無料アカウント）で `GET /users/me/meetings?type=scheduled` をcurl実行してAPIスコープ制限（エラー3161）を実機確認する必要がある
- Phase 13実装前: Zoom OAuthスコープ名 `meeting:read:list_meetings:admin` をDeveloper Consoleで確認（現在信頼度LOW）
- Phase 14実装前: `meeting_menus` 既存RLSポリシー「Anyone can view active menus」とアプリ層フィルタの競合を確認する

## Session Continuity

Last session: 2026-03-28T23:04:42.111Z
Stopped at: Completed 16-member-activity-01-PLAN.md
Resume file: None
Next step: `/gsd:plan-phase 12`
