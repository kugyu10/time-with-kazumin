# Time with Kazumin（かずみん、時間空いてる？）

## What This Is

コーチ・対話師「かずみん」のコーチングセッション予約・管理サービス。ポイント制サブスクモデルで、会員は毎月付与されるポイントを使ってセッションを予約する。非会員（ゲスト）もカジュアルな30分セッションを無料で体験できる。「友だちに声をかけるように、気軽にセッションを予約できる」体験を提供する。

## Core Value

**気軽にかずみんに会いに行ける予約体験** — 堅苦しいビジネスミーティングの予約ではなく、「かずみん、時間空いてる？」と友だちに声をかける感覚でセッションを予約できること。

## Current Milestone: v1.3 運用改善

**Goal:** プランタイプ別メニュー制御、Zoomカレンダーブロック、ポイント溢れ通知、会員アクティビティ可視化で運用品質を向上

**Target features:**
- Zoomカレンダー参照 (#12) — ZOOM_A/ZOOM_Bスケジュールも空き時間判定に含める（暫定対応）
- プランタイプ別メニュー表示 (#10) — メニュー可視性をプランタイプに依存させる
- ポイント溢れ通知メール (#9) — 毎月20日バッチでmax_points超過予定の会員にリマインダー
- 会員アクティビティ表示 (#8) — 会員一覧で30日/60日未訪問を色分け＋ダッシュボードにリスト表示

## Current State

**v1.2 安定化 — SHIPPED** (2026-03-16)

バグ修正とE2Eテスト導入で本番品質を安定化。

**Tech stack:** Next.js App Router + Supabase + Vercel + shadcn/ui
**Codebase:** ~19,000 LOC TypeScript/TSX
**E2E:** Playwright 1.58.2 + GitHub Actions CI

## Shipped Milestones

**v1.2 安定化 — SHIPPED** (2026-03-16)
- 4 phases (8-11), 7 plans, 10 requirements
- See `.planning/milestones/v1.2-REQUIREMENTS.md`

**v1.1 営業時間拡張 — SHIPPED** (2026-03-03)
- 1 phase, 1 plan, 7 requirements
- See `.planning/milestones/v1.1-REQUIREMENTS.md`

**v1.0 MVP — SHIPPED** (2026-02-23)
- 6 phases, 15 plans, 24 requirements
- See `.planning/milestones/v1.0-REQUIREMENTS.md`

## Requirements

### Validated (v1.1)

**祝日対応** (3 requirements)
- ✓ 祝日は全曜日共通で1つの営業時間パターンを適用できる — v1.1
- ✓ 祝日かどうかを外部API（holidays-jp）で自動判定する — v1.1
- ✓ 管理画面で祝日用の営業時間を設定できる — v1.1

**休憩時間** (2 requirements)
- ✓ 曜日ごとに休憩時間を設定できる — v1.1
- ✓ 休憩時間中は予約スロットが表示されない — v1.1

**予約自動完了** (2 requirements)
- ✓ 予約終了30分後に自動的にステータスがcompletedになる — v1.1
- ✓ サンキューメールはステータスがcompletedになった予約に送信される — v1.1

### Validated (v1.0)

**ゲスト向け** (4 requirements)
- ✓ 空き時間を日付指定で閲覧できる — v1.0
- ✓ 会員登録なしでカジュアル30分セッションを予約できる — v1.0
- ✓ 自分のカジュアル予約をキャンセルできる — v1.0
- ✓ 予約完了後、1クリックでGoogleカレンダーに登録できる — v1.0

**会員向け** (6 requirements)
- ✓ Google認証またはメール/パスワードでログインできる — v1.0
- ✓ メニュー選択してポイント消費で予約できる — v1.0
- ✓ 現在のポイント残高を確認できる — v1.0
- ✓ 自分の予約一覧を確認できる — v1.0
- ✓ 予約をキャンセルしてポイント返還を受けられる — v1.0
- ✓ セッション前日にリマインダーメールを受け取れる — v1.0

**管理者向け** (7 requirements)
- ✓ 曜日別の営業時間を設定できる（祝日は別パターン） — v1.0
- ✓ Googleカレンダーと同期して空き時間を自動反映できる — v1.0
- ✓ 全予約一覧を確認・ステータス変更・キャンセルできる — v1.0
- ✓ 会員を招待・登録・退会させることができる — v1.0
- ✓ 会員のポイントを手動で付与/減算できる — v1.0
- ✓ メニュー（セッション種別）をCRUD管理できる — v1.0
- ✓ プラン（サブスクプラン）をCRUD管理できる — v1.0

**システム自動処理** (7 requirements)
- ✓ 毎月1日にプランに応じたポイントを自動付与する — v1.0
- ✓ 予約確定時にZoom会議を自動生成する — v1.0
- ✓ キャンセル時にZoom会議を削除する — v1.0
- ✓ 予約確認メールを送信する — v1.0
- ✓ セッション終了後30分でサンキューメールを送信する — v1.0
- ✓ キャンセル時にキャンセルメールを送信する — v1.0
- ✓ 予約時に管理者カレンダーにイベント追加、キャンセル時に削除する — v1.0

### Validated (v1.2)

**バグ修正** (5 requirements)
- ✓ キャンセル時にZoom側の会議が確実に削除される — v1.2
- ✓ 全画面でJST表示を統一、UTC/JST変換規約を明文化 — v1.2
- ✓ 会員招待時にウェルカムメールが送られる — v1.2
- ✓ 管理者カレンダーの予定がスロットに正確に反映される — v1.2
- ✓ 予約詳細画面の時刻がJSTで表示される — v1.2

**E2Eテスト** (5 requirements)
- ✓ Playwright E2E環境構築（Vercel preview + Supabase dev） — v1.2
- ✓ ゲスト予約フローE2Eテスト — v1.2
- ✓ 会員ログインフローE2Eテスト — v1.2
- ✓ 会員予約フローE2Eテスト — v1.2
- ✓ GitHub ActionsでE2E自動実行 — v1.2

### Active

（v1.3 REQUIREMENTS.md で定義）

### Out of Scope

- 決済機能（Stripe連携） — MVP後、member_plansにstripe_subscription_id追加で対応
- 詳細キャンセルポリシー — MVP後、時間制限チェック追加で対応
- LINE通知 — MVP後、通知チャネル抽象化で対応
- コーチ複数人対応 — 大規模変更のため将来検討
- メールテンプレートUI編集 — MVP初期はコードベース管理で十分
- Zoomアカウント管理UI — 2アカウント固定のため環境変数管理で十分
- ユーザーカレンダーへの自動追加 — OAuth審査回避のためURLスキーム方式

## Context

**現状の課題（TimeRexからの移行理由）:**
- 顧客管理: 誰がいつ予約したか、セッション履歴を管理しづらい
- ポイント管理: サブスクプランに応じたポイント付与・消費の仕組みがない
- Zoomアカウント使い分け: メニューに応じて異なるZoomアカウントを使い分けられない
- 柔軟なメニュー設定: 時間・消費ポイントを自由に設定・変更できない

**ユーザー規模:**
- 現在約10人、週3〜5件の予約
- 無料枠で十分運用可能（Supabase 500MB、Vercel無料）

**ブランド方針:**
- ブランドカラー: オレンジ
- モチーフ: 太陽、ひまわり、笑顔
- トーン: パッと気分が明るくなる、あたたかい雰囲気
- 目指す体験: サイト初回訪問者が「なんか明るい気分になった」と感じること

## Constraints

- **Tech stack**: Next.js (App Router) + Supabase + Vercel + shadcn/ui — 開発者のフルスタック技術選好と合致、エコシステム成熟
- **Zoomアカウント**: A（有料）とB（無料）の2アカウント固定 — カジュアルセッションはB（40分自動終了）、会員セッションはA
- **カレンダー同期**: オンデマンド方式（15分キャッシュ） — 現規模では十分、100人超でcronバッチに切り替え検討
- **メール送信**: Resend月3,000通無料枠 — MVP規模に十分

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase選択 | PostgreSQLトランザクション整合性でポイント管理を担保、Auth+Edge Functions統合 | ✓ Validated |
| カレンダー登録はURLスキーム方式 | ユーザーカレンダーwrite権限不要でOAuth審査回避、全ユーザー共通実装 | ✓ Validated |
| メールテンプレートはReact Email管理 | リッチエディタUI不要、MVP初期は変更頻度低い | ✓ Validated |
| ポイント残高をmember_plansに直接保持 | 残高取得を1クエリで完結（KISS原則） | ✓ Validated |
| Sagaパターン予約フロー | 8ステップの補償トランザクション実装 | ✓ Validated |
| Edge Functions + pg_cron | 定期タスク自動化（月次ポイント、リマインダー、サンキューメール） | ✓ Validated |
| 祝日パターン全曜日共通化 | 曜日別7パターンは複雑すぎる、1パターンで十分 | ✓ Validated (v1.1) |
| Playwright E2E + Vercel preview | 本番環境差分を排除、ローカル品質はUTで担保 | ✓ Validated (v1.2) |
| page.route()モック方式 | 外部API（Zoom/Calendar/Resend）に依存しないE2E設計 | ✓ Validated (v1.2) |
| GitHub Actions 2-job構成 | wait-for-preview→e2eの分離で障害切り分け容易 | ✓ Validated (v1.2) |

---
*Last updated: 2026-03-29 after Phase 15 (ポイント溢れ通知メール) complete — 毎月20日にポイント溢れ予定会員へ自動リマインダーメール送信Edge Function + pg_cron*
