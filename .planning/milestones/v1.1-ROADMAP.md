# Roadmap: Time with Kazumin

## Overview

Time with Kazuminは、気軽にコーチングセッションを予約できるポイント制予約システムです。このロードマップは、データベース基盤の構築から始まり、トランザクション整合性を担保したポイント管理、外部API統合(Google Calendar、Zoom、Resend)、そして自動化タスクまでの6段階で構成されています。各フェーズは、分散トランザクション、ポイント二重消費、OAuthトークンライフサイクルといった重大リスクに対処しながら、段階的に機能を積み上げる設計です。

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: データベース基盤** - トランザクション整合性とRLSによる堅牢なDB設計
- [x] **Phase 2: 認証と予約コア** - Sagaパターンによる予約オーケストレーションと会員認証
- [x] **Phase 3: ゲスト予約体験** - 非会員向けカジュアルセッション予約フロー
- [x] **Phase 4: 外部API統合** - Google Calendar、Zoom、Resend統合とレート制限対策
- [x] **Phase 5: 管理機能** - 管理者向け設定・CRUD管理画面
- [x] **Phase 6: 自動化タスク** - Edge Functionsによる月次ポイント付与とリマインダー

## Phase Details

### Phase 1: データベース基盤
**Goal**: トランザクション整合性とセキュリティを担保したPostgreSQLスキーマの確立
**Depends on**: Nothing (first phase)
**Requirements**: SYS-01 (一部: Stored Procedure設計)
**Success Criteria** (what must be TRUE):
  1. ポイント消費・返還が並行処理でもレースコンディションを起こさず正確に動作する
  2. 同じ時間帯への二重予約がデータベース制約によって自動的に防止される
  3. ゲスト・会員・管理者が適切な権限でデータアクセスできる(RLS有効)
  4. マイグレーションをUP/DOWNの両方向で実行でき、CI/CD自動化が可能
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Supabaseローカル環境セットアップ、8テーブル定義、EXCLUDE制約による二重予約防止
- [x] 01-02-PLAN.md — RLSポリシー実装（JWT claimベース権限分離）、Stored Procedures（ポイント消費・返還・月次付与）

### Phase 2: 認証と予約コア
**Goal**: Sagaパターンで整合性を保った会員向け予約フロー実装
**Depends on**: Phase 1
**Requirements**: MEMBER-01, MEMBER-02, MEMBER-03, MEMBER-04, MEMBER-05
**Success Criteria** (what must be TRUE):
  1. 会員はGoogleアカウントまたはメール/パスワードでログインできる
  2. 会員は空き時間を確認し、メニューを選択してポイント消費で予約できる
  3. 予約作成が途中で失敗した場合、補償処理によってポイントが返還される
  4. 会員は自分の予約一覧を確認でき、キャンセル時にポイント返還を受けられる
  5. 会員は現在のポイント残高を確認できる
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md — Supabase Auth統合（Google OAuth＋メール認証）、認証ガード、招待制チェック
- [x] 02-02-PLAN.md — Sagaパターンによる予約作成フロー（モック版）、冪等性キー、ポイント残高表示
- [x] 02-03-PLAN.md — 予約一覧・詳細表示、キャンセルフロー、ポイント返還

### Phase 3: ゲスト予約体験
**Goal**: 非会員向けの気軽なカジュアルセッション予約フロー
**Depends on**: Phase 1
**Requirements**: GUEST-01, GUEST-02, GUEST-03, GUEST-04
**Success Criteria** (what must be TRUE):
  1. ゲストは会員登録せずに空き時間を日付指定で閲覧できる
  2. ゲストは名前とメールアドレスの入力だけでカジュアル30分セッションを予約できる
  3. ゲストは予約完了後、1クリックでGoogleカレンダーに登録できる
  4. ゲストは自分のカジュアル予約をキャンセルできる
  5. 悪意あるゲストによるレート制限攻撃が防止される
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md — service_roleクライアント、レート制限、空きスロットAPI、ゲスト予約作成API、予約フローUI
- [x] 03-02-PLAN.md — JWTキャンセルトークン、Google Calendar URL生成、キャンセルAPI、予約完了ページ、キャンセルページ

### Phase 4: 外部API統合
**Goal**: Google Calendar、Zoom、Resendの統合と補償処理の実装
**Depends on**: Phase 2, Phase 3
**Requirements**: SYS-02, SYS-03, SYS-04, SYS-06, SYS-07, ADMIN-02
**Success Criteria** (what must be TRUE):
  1. 予約確定時にメニューに応じたZoomアカウント(A/B)で会議が自動生成される
  2. 管理者のGoogleカレンダーと同期し、busy時間が空き時間計算に反映される
  3. 予約確認メールとキャンセルメールが自動送信される(ユーザー+管理者宛)
  4. キャンセル時にZoom会議が削除され、管理者カレンダーからイベントが削除される
  5. OAuth認証トークンの有効期限切れ時に自動リフレッシュが動作する
  6. Google Calendar APIレート制限(10 QPS)を超えた場合にエラーハンドリングが動作する
**Plans**: 3 plans

Plans:
- [x] 04-01-PLAN.md — OAuth基盤、Google Calendar FreeBusy統合、空きスロットAPI拡張
- [x] 04-02-PLAN.md — Zoom Server-to-Server OAuth、Resend + React Email、Saga本実装
- [x] 04-03-PLAN.md — キャンセル処理（Zoom削除、Calendar削除、キャンセルメール）

### Phase 5: 管理機能
**Goal**: 管理者向け設定・CRUD管理画面の実装
**Depends on**: Phase 2
**Requirements**: ADMIN-01, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06, ADMIN-07
**Success Criteria** (what must be TRUE):
  1. 管理者は曜日別の営業時間を設定でき、祝日パターンを別途設定できる
  2. 管理者は全予約一覧を確認し、ステータス変更・キャンセルができる
  3. 管理者は会員を招待・登録・退会させることができる
  4. 管理者は会員のポイントを手動で付与/減算できる
  5. 管理者はメニュー(セッション種別)をCRUD管理できる
  6. 管理者はプラン(サブスクプラン)をCRUD管理できる
**Plans**: 3 plans

Plans:
- [x] 05-01-PLAN.md — 管理画面基盤（レイアウト、サイドバー、DataTable）、メニューCRUD、プランCRUD
- [x] 05-02-PLAN.md — 営業時間管理、会員管理、ポイント調整
- [x] 05-03-PLAN.md — 予約管理（一覧・ステータス変更・キャンセル）

### Phase 6: 自動化タスク
**Goal**: Edge Functionsによる月次ポイント付与、リマインダー、サンキューメール自動化
**Depends on**: Phase 4
**Requirements**: SYS-01, SYS-05, MEMBER-06
**Success Criteria** (what must be TRUE):
  1. 毎月1日にプランに応じたポイントが全会員に自動付与される
  2. セッション前日にリマインダーメールが自動送信される
  3. セッション終了後30分でサンキューメールが自動送信される(ON/OFF設定可能)
  4. 自動化タスクが失敗した場合、管理者に通知される
  5. 自動化タスクの実行履歴が管理画面で確認できる
**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md — DB基盤（task_execution_logs、カラム追加、pg_cronジョブ）、メールテンプレート、メニュー設定拡張
- [x] 06-02-PLAN.md — Edge Functions（月次ポイント、リマインダー、サンキュー）、タスク履歴管理画面

### Phase 7: 営業時間拡張
**Goal**: 祝日・休憩時間・予約自動完了で営業時間管理を強化
**Depends on**: Phase 6
**Requirements**: HOLIDAY-01, HOLIDAY-02, HOLIDAY-03, BREAK-01, BREAK-02, AUTO-01, AUTO-02
**Success Criteria** (what must be TRUE):
  1. 祝日（例: 2026/3/20春分の日）に予約すると、祝日パターンの営業時間が表示される
  2. 管理画面で「祝日」タブから営業時間を1つだけ設定できる
  3. 休憩時間を設定すると、その時間帯のスロットが予約不可になる
  4. 終了30分後の予約がcompletedに自動更新される
  5. completedになった予約に対してサンキューメールが送信される
**Plans**: 1 plan (予定)

Plans:
- [ ] 07-01-PLAN.md — 祝日パターン全曜日共通化、管理画面UI修正

**Implementation Status:**
- [x] 祝日判定ユーティリティ (holidays.ts) — 実装済み
- [x] 休憩時間DBカラム追加 — マイグレーション済み
- [x] スロット生成API修正（祝日判定・休憩時間対応）— 実装済み
- [x] 予約自動完了Edge Function — 実装済み
- [ ] 祝日パターンを全曜日共通化 — **要修正**
- [ ] 管理画面祝日設定UI — **要修正**

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. データベース基盤 | 2/2 | ✅ Complete | 2026-02-22 |
| 2. 認証と予約コア | 3/3 | ✅ Complete | 2026-02-22 |
| 3. ゲスト予約体験 | 2/2 | ✅ Complete | 2026-02-22 |
| 4. 外部API統合 | 3/3 | ✅ Complete | 2026-02-22 |
| 5. 管理機能 | 3/3 | ✅ Complete | 2026-02-22 |
| 6. 自動化タスク | 2/2 | ✅ Complete | 2026-02-23 |
| 7. 営業時間拡張 | 0/1 | ◆ In Progress | — |

**v1.0 MVP: SHIPPED** (2026-02-23)
See `.planning/milestones/v1.0-ROADMAP.md` for full details.

**v1.1 営業時間拡張: IN PROGRESS** (started 2026-03-03)
