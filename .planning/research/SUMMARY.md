# Project Research Summary

**Project:** Time with Kazumin — v1.3 運用改善
**Domain:** コーチングセッション予約管理システム（ポイント制サブスクリプション）
**Researched:** 2026-03-27
**Confidence:** HIGH

## Executive Summary

v1.3は新機能の追加ではなく、既存システムの運用品質を高める改善マイルストーンである。追加する4機能（Zoomカレンダーブロック・プランタイプ別メニュー表示・ポイント溢れ通知メール・会員アクティビティ表示）はすべて、既存スタック（Next.js 15 + Supabase + Zoom S2S OAuth + Resend）の上に乗る。新規npmパッケージのインストールは不要。DBマイグレーション2件とEdge Function 1件の追加が中心となる。

推奨アプローチは「既存パターンの徹底踏襲」である。Zoomカレンダーブロックは `getCachedBusyTimes()` のLRUキャッシュ設計をそのままZoomにも適用する。ポイント溢れ通知はすでに稼働実績のある `monthly-point-grant` Edge Function と同一パターンで実装する。会員アクティビティは新テーブル不要で `bookings` テーブルへの集計クエリのみ。プランタイプ別メニューのみDBスキーマ変更（`meeting_menus.allowed_plan_types` カラム追加）が必要で、これがフェーズの依存関係起点になる。

主要リスクは2点。(1) ZoomアカウントB（無料）のAPIスコープ制限（エラーコード3161）— 実装前に手動検証が必要。(2) pg_cronのUTC固定動作によるタイムゾーン誤設定 — cron式をJSTで書かず必ずUTC基準で計算する。どちらも既知の問題で対策が確立されており、事前確認でリスクを低減できる。

## Key Findings

### Recommended Stack

v1.3で新規追加するnpmパッケージはゼロ。既存スタック（Next.js 15 / React 19 / TypeScript 5 / Supabase / Vercel / shadcn/ui / Tailwind CSS 4）をそのまま使用する。追加するのはDBマイグレーション2件（`meeting_menus.allowed_plan_types` カラム追加、pg_cronジョブ登録）とEdge Function 1件（`point-overflow-notify`）のみ。

**使用する既存技術:**
- `Zoom S2S OAuth + LRU Cache`: 既存 `getZoomAccessToken()` を再利用。`GET /users/me/meetings?type=scheduled` を追加 — 新ライブラリ不要
- `pg_cron + pg_net`: 既存 `monthly-point-grant` と同一パターン。`0 0 20 * *`（UTC）で毎月20日実行
- `Resend + React Email`: 新規メールテンプレート1コンポーネントを追加するだけ — テンプレート追加のみ
- `date-fns v4`: Zoom `start_time + duration` から end_time を `addMinutes()` で算出 — バージョン変更なし
- `lru-cache v11`: Zoomスケジュール取得にも15分TTLでキャッシュ — 既存 `busyTimesCache` と同設計

詳細: `.planning/research/STACK.md`

### Expected Features

**Must have（table stakes）:**
- **プランタイプ別メニュー表示** — 「使えないメニューが見える」はUX上の欠陥。`meeting_menus.allowed_plan_types INTEGER[]` カラム追加で対応
- **Zoomカレンダーブロック** — Zoom直接ブロックと予約システムの矛盾は運用混乱を招く。`getZoomScheduledMeetings()` を `getCachedBusyTimes()` と統合
- **ポイント溢れ通知メール** — `max_points` 設定プランがある以上、事前通知はユーザーへの誠実な対応
- **会員アクティビティ表示** — 管理者の感覚的把握をデータで補完。最も実装コストが低い

**Should have（competitive）:**
- **プランタイプ別メニューの管理UI** — 管理者がメニューとプランの対応を画面上で設定できる
- **会員アクティビティフィルタ** — 色分けバッジ + active/inactiveソート機能のセット

**Defer（v2+）:**
- Zoom FreeBusy APIへの正式移行（`type=scheduled` 暫定取得からの脱却）
- 会員向けポイント残高アラート（管理者向けとは別チャンネル）
- LINE通知対応
- プランに応じた予約上限数制限（既存ポイント制が自然な制約として機能）

詳細: `.planning/research/FEATURES.md`

### Architecture Approach

v1.3の全機能は既存アーキテクチャ（Next.js App Router + Server Actions + Supabase + 外部API統合）の延長として実装できる。スロット空き判定フロー（Google Calendar FreeBusy → isSlotBusy()）にZoomスケジュールを並列追加するのが核心。プランタイプ別メニューは `meeting_menus` テーブルの単一カラム追加でフィルタロジックを実現し、中間テーブルの複雑さを避ける（`allowed_plan_types IS NULL` = 全プラン対象という後方互換設計）。

**主要コンポーネントと変更点:**
1. `src/lib/integrations/zoom.ts` — `getZoomScheduledMeetings(accountType)` 関数追加（Zoomスケジュール取得 + 15分LRUキャッシュ）
2. `src/app/api/public/slots/route.ts` / `week/route.ts` — ZoomのBusyTime[]をGoogleのBusyTime[]とマージ
3. `supabase/functions/point-overflow-notify/index.ts` — 新規Edge Function（monthly-point-grantパターン踏襲）
4. `src/lib/actions/admin/members.ts` — `getMembers()` クエリに `MAX(bookings.start_time)` LEFT JOIN追加
5. DB Migration — `meeting_menus.allowed_plan_types INTEGER[] DEFAULT NULL` + GINインデックス

詳細: `.planning/research/ARCHITECTURE.md`

### Critical Pitfalls

1. **ZoomアカウントB（無料）のAPI制限エラー3161** — 実装前に `GET /users/me/meetings?type=scheduled` をアカウントBでcurl検証。3161エラーのフォールバック（空配列返却 + ログ記録）を必ず実装する
2. **Zoom APIキャッシュ未実装によるレート制限** — `zoom.ts` に `getCachedZoomSchedules()` を追加してTTL 15分以上のLRUキャッシュを設定。キャッシュなしでの実装は避ける
3. **RLSポリシー競合（複数permissiveポリシーのOR結合）** — `meeting_menus` の既存ポリシー「Anyone can view active menus」を DROP して置き換えるか、アプリ層（Server Actions）でフィルタを実装する
4. **pg_cronのタイムゾーン誤設定** — pg_cronはUTC固定。JST 20日09:00実行 = `0 0 20 * *`（UTC）。cron式をJSTで書かない
5. **pg_cronジョブ登録漏れ** — 新Edge Functionデプロイとpg_cronジョブ登録を同一マイグレーションファイルに含め、`supabase db push` 1コマンドで完結させる

詳細: `.planning/research/PITFALLS.md`

## Implications for Roadmap

研究から導かれる推奨フェーズ構造:

### Phase 1: DBスキーマ変更（基盤）
**Rationale:** `meeting_menus.allowed_plan_types` カラム追加はプランタイプ別メニュー（Phase 3）の前提条件。最初に着手してアンブロックする。
**Delivers:** `meeting_menus.allowed_plan_types INTEGER[] DEFAULT NULL` マイグレーション適用済み
**Addresses:** プランタイプ別メニュー表示（#10）の依存解消
**Avoids:** Phase 3でスキーマ変更を後付けする際の手戻り

### Phase 2: Zoomカレンダーブロック（独立・高リスク先行）
**Rationale:** 他機能に依存しないが、ZoomアカウントBのAPI制限という未知リスクを最初に潰す。問題が発覚した場合の設計変更を早めに行う。
**Delivers:** Zoomスケジュール済み会議をBusyTime[]として空き枠計算に統合
**Uses:** 既存 `getZoomAccessToken()` + 新規 `getZoomScheduledMeetings()` + 15分LRUキャッシュ
**Avoids:** Pitfall 1（アカウントB制限3161）、Pitfall 2（レート制限）

### Phase 3: プランタイプ別メニュー表示（Phase 1完了後）
**Rationale:** Phase 1のDBマイグレーション完了が前提。管理UI変更と予約フィルタ変更を並行実装できる。
**Delivers:** 管理者がメニューごとに対象プランを設定 + 会員予約画面でプランフィルタが効く
**Implements:** `menus.ts` Server Action拡張 + 管理画面プラン選択UI + 予約フローフィルタ
**Avoids:** Pitfall 3（RLSポリシー競合）— アプリ層フィルタ推奨

### Phase 4: ポイント溢れ通知メール（独立）
**Rationale:** 他機能に依存しない。`monthly-point-grant` パターンをそのまま踏襲するため設計判断が少なく、pg_cronのUTCタイムゾーン注意が主な実装ポイント。
**Delivers:** 毎月20日（JST 09:00）に溢れ予定会員へ自動メール通知
**Uses:** 新規Edge Function `point-overflow-notify` + pg_cron + Resend + 新規React Emailテンプレート
**Avoids:** Pitfall 4（pg_cronタイムゾーン誤設定）、Pitfall 5（pg_cronジョブ登録漏れ）

### Phase 5: 会員アクティビティ表示（独立・最低リスク）
**Rationale:** スキーマ変更なし、外部API追加なし。最もリスクが低く独立した機能。SQL集計クエリのみなので確実に完了できる。
**Delivers:** 管理者会員一覧に30日/60日未訪問バッジ + 管理ダッシュボードに要フォロー会員リスト
**Implements:** `getMembers()` LEFT JOIN拡張 + shadcn/ui Badge + dashboardセクション追加
**Avoids:** Pitfall 6（N+1クエリ）— `MAX(start_time)` GROUP BY集計を1クエリで完結

### Phase Ordering Rationale

- **Phase 1が先行必須:** プランタイプ別メニュー（Phase 3）はDBマイグレーション完了待ち。早めに適用してアンブロックする
- **Phase 2を前倒し:** ZoomアカウントBのAPI制限は実機テスト前の不確定リスク。設計変更が発生した場合の影響を最小化するために前倒し
- **Phase 3はPhase 1後:** 依存関係が明確なため、この順序が必然
- **Phase 4, 5はPhase 2, 3と並行可能:** 互いに独立しているため並列実装も可能。単一開発者であればPhase 2→3→4→5の順次実装が現実的

### Research Flags

追加調査が必要なフェーズ:
- **Phase 2（Zoomカレンダーブロック）:** ZoomアカウントBで `GET /users/me/meetings?type=scheduled` をcurl実行してAPIスコープ制限を確認。Zoom OAuthスコープ名 `meeting:read:list_meetings:admin` の正確な名称をDeveloper Consoleで確認（現在信頼度LOW）

標準パターンで追加調査不要なフェーズ:
- **Phase 1:** 単純なDBマイグレーション
- **Phase 4:** `monthly-point-grant` の完全パターン再利用
- **Phase 5:** 標準的なSQL集計クエリ + shadcn/ui Badge

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | 既存スタックの延長のみ。新規追加ゼロ。稼働実績のあるパターンを再利用 |
| Features | HIGH | 既存コードベースを直接調査済み。各機能の実装箇所が特定されている |
| Architecture | HIGH | 全コンポーネントの変更対象ファイルが具体的に特定されている |
| Pitfalls | MEDIUM-HIGH | RLS/pg_cron/N+1は公式ドキュメント確認済み。ZoomアカウントBは実機未検証 |

**Overall confidence:** HIGH

### Gaps to Address

- **ZoomアカウントBのAPIスコープ制限（Pitfall 1）:** 実装前にcurlで手動検証必須。3161エラーが発生した場合の代替案（DBのbookingsテーブルからのbusy時間参照）を検討する
- **Zoom OAuthスコープ名の正確性:** `meeting:read:list_meetings:admin` はコミュニティ記事ベース（信頼度LOW）。Phase 2実装開始時にDeveloper Consoleで確認する
- **`meeting_menus` 既存RLSポリシーの内容確認:** アプリ層フィルタを採用する場合はRLS変更不要だが、既存ポリシーとの競合を事前に確認する

## Sources

### Primary（HIGH confidence）
- 既存コードベース直接調査 — `zoom.ts`, `google-calendar.ts`, `monthly-point-grant/index.ts`, `members.ts`, `slots/route.ts`, RLSマイグレーション, `automation_tasks.sql`
- [Supabase Schedule Functions 公式ドキュメント](https://supabase.com/docs/guides/functions/schedule-functions) — pg_cron + pg_net 統合パターン
- [Supabase pg_cron 公式ドキュメント](https://supabase.com/docs/guides/database/extensions/pg_cron) — cron構文確認
- [Supabase RLS Multiple Permissive Policies](https://supabase.com/docs/guides/database/database-advisors?lint=0006_multiple_permissive_policies) — ポリシー競合挙動の確認

### Secondary（MEDIUM confidence）
- [Zoom API 公式参考 (zoom.github.io)](https://zoom.github.io/api/) — `GET /users/{userId}/meetings` エンドポイント構造
- [Zoom Developer Forum](https://devforum.zoom.us/) — エンドポイント挙動、日付範囲フィルタ非対応の確認
- [Zoom Community - Error 3161](https://community.zoom.com/t5/Zoom-Meetings/API-Error-code-3161-on-GET-users-userId-meetings-v2-zoom/td-p/238510) — アカウントB制限エラーの実例
- [Zoom API Rate Limits 公式](https://developers.zoom.us/docs/api/rate-limits/) — レート制限仕様
- [pg_cron Timezone Issue（GitHub #16）](https://github.com/citusdata/pg_cron/issues/16) — UTC固定動作の確認

### Tertiary（LOW confidence — needs validation）
- コミュニティ記事複数件 — Zoom OAuthスコープ名 `meeting:read:list_meetings:admin`（Developer Consoleでの実機確認が必要）

---
*Research completed: 2026-03-27*
*Ready for roadmap: yes*
*対象マイルストーン: v1.3 運用改善*
