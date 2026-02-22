# Phase 1: データベース基盤 - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

トランザクション整合性とRLSによる堅牢なPostgreSQLスキーマの確立。ポイント消費・返還のレースコンディション防止、二重予約防止、ロールベースのアクセス制御を実現する。マイグレーションはCI/CDで自動化可能な状態にする。

</domain>

<decisions>
## Implementation Decisions

### ポイント管理設計
- 残高は`member_plans`テーブルに直接保持 + 別途履歴テーブルで監査証跡
- 履歴テーブルには全トランザクション（消費、返還、付与、手動調整）を記録
- ポイントに有効期限なし（無期限）
- 平行アクセスは`SELECT FOR UPDATE NOWAIT`で即時失敗、クライアント側リトライで対応
- ポイント不足時は予約を拒否（マイナス残高は許可しない）
- 管理者の手動調整時、理由入力は任意
- 月次ポイント付与時は上限あり繰り越し（プラン別に上限を設定可能）

### スキーマ命名規則
- テーブル名・カラム名は英語
- テーブル名は複数形（users, bookings, menus）
- カラム名はsnake_case（created_at, member_id）
- 外部キーは`{table}_id`形式（user_id, booking_id）

### マイグレーション戦略
- ツール: Supabase CLI（supabase db diff/push）
- シードデータ: SQLファイル（supabase/seed.sql）
- シード内容: マスターデータのみ（デフォルトプラン、メニュー等の初期設定）
- 環境分離: Supabaseプロジェクトを開発/本番で分離
- CI/CD: main branchへのpush時にGitHub Actionsで自動マイグレーション
- ロールバック: 全マイグレーションにUP/DOWNを記述

### RLSポリシー設計
- ロール定義: JWT claimベース（auth.jwt()でrole参照）
- ロール種類: guest, member, admin の3種類
- ゲストアクセス: anonキー + ユニークトークンで予約データにアクセス
- 管理者権限: RLSをバイパスして全データ参照可能
- 会員間の可視性: 自分の情報のみ閲覧可能（他会員は見えない）
- ゲストの可視性: メニューと空き時間のみ参照可能（トークンで自分の予約も参照可能）
- ポイント履歴: 本人 + 管理者のみ閲覧可能

### Claude's Discretion
- テーブルの正規化レベル
- インデックス設計
- Stored Procedureの具体的な実装パターン
- RLSポリシーの具体的なSQL構文

</decisions>

<specifics>
## Specific Ideas

- ポイント操作は必ずStored Procedureを経由（直接UPDATEは禁止）
- 二重予約防止はUNIQUE制約とトランザクションで担保
- リサーチで指摘された「SELECT FOR UPDATE NOWAIT」パターンを採用

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-database-foundation*
*Context gathered: 2026-02-22*
