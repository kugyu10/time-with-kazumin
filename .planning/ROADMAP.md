# Roadmap: Time with Kazumin

## Milestones

- ✅ **v1.0 MVP** - Phases 1-6 (shipped 2026-02-23)
- ✅ **v1.1 営業時間拡張** - Phase 7 (shipped 2026-03-03)
- 🚧 **v1.2 安定化** - Phases 8-11 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-6) - SHIPPED 2026-02-23</summary>

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

</details>

<details>
<summary>✅ v1.1 営業時間拡張 (Phase 7) - SHIPPED 2026-03-03</summary>

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
**Plans**: 1 plan

Plans:
- [x] 07-01-PLAN.md — 祝日パターン全曜日共通化、管理画面UI修正

</details>

### 🚧 v1.2 安定化 (In Progress)

**Milestone Goal:** バグ修正とE2Eテスト導入で本番品質を安定させる

- [x] **Phase 8: バグ修正** - Zoom・タイムゾーン・メール・カレンダーの本番バグを一括解消 (completed 2026-03-15)
- [ ] **Phase 9: Playwright基盤** - E2Eテスト環境構築（Vercel preview + Supabase dev統合）
- [ ] **Phase 10: テストシナリオ** - ゲスト・会員予約フローのE2Eテスト実装
- [ ] **Phase 11: CI統合** - GitHub ActionsによるE2E自動実行パイプライン

## Phase Details

### Phase 8: バグ修正
**Goal**: 本番環境で発生している4つのバグを修正し、UTC/JST変換規約をコードに明文化する
**Depends on**: Phase 7
**Requirements**: BUG-01, BUG-02, BUG-03, BUG-04, BUG-05
**Success Criteria** (what must be TRUE):
  1. 予約をキャンセルすると、Zoom側の会議が確実に削除されている（Zoom管理画面で確認可能）
  2. `/booking/[id]` の予約詳細画面で時刻がJST（例: 14:00 JST）で表示される
  3. 全画面（ゲスト/会員/管理者）の時刻表示がJSTで統一されており、UTC表示が一切ない
  4. `docs/rules.md` にUTC/JST変換のコーディング規約が記載されており、将来の開発者が参照できる
  5. 会員を招待して承認すると、その会員にウェルカムメールが届く
  6. 管理者Googleカレンダーに登録した予定がスロット一覧に反映されて予約不可になる
**Plans**: 2 plans

Plans:
- [ ] 08-01-PLAN.md — Zoom削除バグ修正（BUG-01）、カレンダーブロック漏れ診断ログ追加（BUG-05）
- [ ] 08-02-PLAN.md — JST時刻表示修正（BUG-02、BUG-03）、docs/rules.md作成、招待メール送信（BUG-04）

### Phase 9: Playwright基盤
**Goal**: Playwright 1.58.2をインストールし、Vercel preview + Supabase dev環境を対象にテストが実行できる環境を構築する
**Depends on**: Phase 8
**Requirements**: E2E-01
**Success Criteria** (what must be TRUE):
  1. `npm run test:e2e` を実行すると、Playwright がVercel preview URLに接続してテストを起動できる
  2. `npm run test:e2e:ui` でPlaywright UIモードが起動し、ブラウザでテストをデバッグできる
  3. テストユーザー（会員・管理者）がglobal-setupで自動作成され、global-teardownで削除される
  4. `e2e/.auth/` のセッションファイルが `.gitignore` に追加されており、誤コミットしない
**Plans**: 2 plans

Plans:
- [ ] 09-01-PLAN.md — Playwright 1.58.2インストール、playwright.config.ts（デュアルモード設定）、package.jsonスクリプト追加
- [ ] 09-02-PLAN.md — global-setup/teardown（テストユーザーCRUD）、auth.setup.ts（storageState保存）、fixtures.ts

### Phase 10: テストシナリオ
**Goal**: ゲスト予約・会員ログイン・会員予約の3フローについてE2Eテストが全てパスする状態にする
**Depends on**: Phase 9
**Requirements**: E2E-02, E2E-03, E2E-04
**Success Criteria** (what must be TRUE):
  1. ゲスト予約フロー（スロット選択→予約完了→キャンセル）のテストがパスする
  2. 予約完了画面でZoom URLがJSTの時刻とともに表示されていることをテストで検証できる
  3. 会員がメール/パスワードでログインしてダッシュボードにリダイレクトされることをテストで検証できる
  4. 会員予約フロー（メニュー選択→ポイント消費→予約確定）のテストがパスし、ポイント残高の変化が確認できる
  5. Zoom/Google Calendar/Resend の実API呼び出しは `page.route()` でモック化されており、外部サービスに依存しない
**Plans**: TBD

Plans:
- [ ] 10-01-PLAN.md — ゲスト予約フローE2Eテスト（booking-flow.spec.ts）、外部APIモック実装
- [ ] 10-02-PLAN.md — 会員ログインフローE2Eテスト（auth.spec.ts）、会員予約フローE2Eテスト（member-booking.spec.ts）

### Phase 11: CI統合
**Goal**: GitHub Actionsでdevelopブランチへのpushまたはmain PRに対してE2EテストがVercel preview URL向けに自動実行される
**Depends on**: Phase 10
**Requirements**: E2E-05
**Success Criteria** (what must be TRUE):
  1. developブランチにpushすると、GitHub ActionsでE2Eテストが自動実行される
  2. Vercel preview URLが自動取得され（patrickedqvist/wait-for-vercel-preview使用）、そのURLに対してテストが実行される
  3. GitHub Secretsに必要な環境変数（SUPABASE_DEV_URL、SUPABASE_DEV_ANON_KEY、SUPABASE_DEV_SERVICE_ROLE_KEY）が設定されている
  4. E2Eテストが失敗した場合、GitHub Actions上で失敗として記録され、原因を特定できるアーティファクトが残る
**Plans**: TBD

Plans:
- [ ] 11-01-PLAN.md — GitHub Actions e2e.ymlワークフロー作成、Vercel preview URL自動取得、Secrets設定ガイド

## Progress

**Execution Order:**
Phases execute in numeric order: 8 → 9 → 10 → 11

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. データベース基盤 | v1.0 | 2/2 | Complete | 2026-02-22 |
| 2. 認証と予約コア | v1.0 | 3/3 | Complete | 2026-02-22 |
| 3. ゲスト予約体験 | v1.0 | 2/2 | Complete | 2026-02-22 |
| 4. 外部API統合 | v1.0 | 3/3 | Complete | 2026-02-22 |
| 5. 管理機能 | v1.0 | 3/3 | Complete | 2026-02-22 |
| 6. 自動化タスク | v1.0 | 2/2 | Complete | 2026-02-23 |
| 7. 営業時間拡張 | v1.1 | 1/1 | Complete | 2026-03-03 |
| 8. バグ修正 | 2/2 | Complete   | 2026-03-15 | - |
| 9. Playwright基盤 | 1/2 | In Progress|  | - |
| 10. テストシナリオ | v1.2 | 0/2 | Not started | - |
| 11. CI統合 | v1.2 | 0/1 | Not started | - |
