# 研究統合レポート: Time with Kazumin コーチングセッション予約システム

**調査実施日:** 2026-02-22
**プロジェクト:** コーチングセッション予約・ポイント管理サービス
**統合研究信頼度:** HIGH (全領域で複数ソース検証済み)

---

## エグゼクティブサマリー

Time with Kazuminは、ポイント制サブスクリプションを核とする差別化されたコーチング予約システムです。市場標準（Calendly、Acuity等）と異なり、月次自動付与ポイント、Zoomアカウント自動振り分け（カジュアル40分制限/有料無制限）、祝日対応営業時間が独自機能です。

技術的には、Next.js 15 + Supabase + Vercel構成で**MVP規模（週3-5予約、ユーザー10人未満）なら完全無料運用可能**ですが、分散トランザクション管理、ポイント整合性、OAuth トークンライフサイクルの3領域で重大なシステムリスクがあります。

推奨アプローチは、**Phase 1で徹底したDB設計（トランザクション・RLS・マイグレーション）を行い、Phase 2でSagaパターン設計の補償処理を実装してから外部API統合**に進むことで、中盤以降の大規模書き換えを回避することです。

---

## キー・ファインディングス

### STACK.md から: 技術スタック選定

**推奨コア技術:**
- **Next.js 15.x** — App Router安定版、React 19対応、Turbopack開発体験向上。ただしNext.js 16も2026年2月リリース済みのため、移行戦略を慎重に検討
- **React 19.x** — React Compilerで自動最適化、App Router推奨
- **TypeScript 5.8.x** — 2025年2月リリースの最新版、ESM要件対応
- **Supabase（PostgreSQL 15+）** — ポイント管理にPostgreSQL Stored Procedureで ACID保証が必須、RLS宣言的制御で権限管理を単純化
- **Tailwind CSS 4.x** — Rust製Oxideで5倍高速ビルド、Modern CSS対応
- **shadcn/ui 3.8.5+** — Radix UI統合（2026年2月から統合パッケージ）でベンダーロックイン回避
- **Resend + React Email** — 月3,000通無料、React Emailで型安全テンプレート管理
- **Vercel** — Next.js開発元、無料枠でMVP十分（ただし10秒タイムアウト注意）

**バージョン互換性の注意点:**
- Node.js 20以上必須（Supabase.js v2.79.0+がNode.js 18サポート終了）
- Tailwind CSS v4は設定方式変更（`tailwind.config.js` → `@theme`ディレクティブ）
- React Email 5.x はNext.js 16最適化だがNext.js 15でも使用可能

**避けるべき技術:**
- Moment.js（2020年メンテナンス停止、67KB）→ date-fns 4.xで代替
- Next.js 14以前（キャッシングセマンティクス変更、Turbopack未安定）
- クライアント側OAuth（Zoom/Google）→ サーバー側認証（Route Handler、Edge Functions）必須

**スケーリングパターン:**
- 現在（週3-5予約）: Supabase無料 + Vercel無料 → 完全無料
- ユーザー100人超: Supabase Pro $25/月、Vercel Pro $20/月検討
- Google Calendar APIレート制限（10 QPS）対策：キャッシュ排他制御 → cronバッチ化（ユーザー20人超で検討）

---

### FEATURES.md から: MVP機能優先度

**テーブルステークス（ユーザー期待基本機能）:**
- オンライン予約（ゲスト・会員）
- カレンダー同期（Google）
- 営業時間設定（曜日別+祝日）
- ビデオ会議統合（Zoom自動生成）
- 自動リマインダー（メール）
- 予約確認・キャンセル通知
- キャンセル・ポイント返還

**差別化要素（競争優位性）:**
1. **ポイント制サブスクリプション** — 市場では珍しい（SuperSaaS、SimplyBook.meのみ）、顧客ロイヤルティと柔軟性を両立
2. **Zoomアカウント使い分け** — カジュアル（40分制限）と有料（無制限）を自動切り替え、一般ツール非対応
3. **祝日対応営業時間** — Google公開カレンダー連携で日本市場向け細かい配慮
4. **ミーティングバッファ** — セッション前後の余裕時間を個別設定
5. **パーソナライズUX** — 「堅苦しいビジネス予約」ではなく「友だちに声をかける」感覚

**アンチフィーチャー（実装してはいけない）:**
- リアルタイム全自動カレンダー同期 → 15分キャッシュで十分、API無駄使い
- リッチテキストメールエディタUI → React Emailでコード管理、変更頻度低い
- ユーザーカレンダーへの自動書き込み → OAuth審査・write権限要求で遅延、1クリックURLスキーム回避
- 複数コーチ対応 → 現状1人運用で不要、YAGNI原則
- 詳細キャンセルポリシー（時間制限） → MVP初期は信頼関係ベース、悪用発生時に追加

**MVP確定機能（v1ローンチに必須）:**
- P1: 15機能（オンライン予約、ポイント制、Zoom、カレンダー同期、営業時間、バッファ、リマインダー、キャンセル、無料体験、招待制登録、手動調整等）

**検証後追加（v1.x）:**
- P2: 決済統合（会員10-20人到達時）、サンキューメール、SMS、時間制限ポリシー、クライアントポータル、分析機能

---

### ARCHITECTURE.md から: 推奨アーキテクチャパターン

**全体構成:** Next.js App Router + Supabase + Edge Functions の3層

```
Presentation Layer (Next.js SSR/RSC)
    ↓
Application Layer (Route Handlers / Server Actions)
    ↓
Business Logic Layer (予約/ポイント/空き時間計算)
    ↓
Integration Layer (Google Calendar / Zoom / Resend)
    ↓
Data Layer (PostgreSQL with RLS + Edge Functions)
```

**6つの推奨パターン:**

1. **Server-First Architecture（デフォルトサーバーコンポーネント）**
   - RSCで初期表示高速化・バンドルサイズ削減
   - クライアントコンポーネント（`'use client'`）は必要な箇所のみ
   - 特に予約システムは新鮮なデータが重要

2. **PostgreSQL Stored Procedures（トランザクション保証）**
   - ポイント消費・返還は`consume_points()`関数でACID保証
   - `SELECT FOR UPDATE`でレースコンディション防止
   - TypeScriptコードから分離、型安全性低下の代わりにロジック一元化

3. **Optimistic Locking（ダブルブッキング防止）**
   - 予約作成前に再度スロット空き確認
   - UNIQUE INDEX制約で二重予約を自動排除
   - ユーザーに明確なエラー返却、再選択フロー用意

4. **Compensating Transactions（外部API統合の整合性）**
   - 各ステップに補償処理を定義（ポイント消費→返還、Zoom作成→削除）
   - 失敗時は逆順に巻き戻し実行
   - 冪等性キー（Idempotency-Key）で再試行時の二重処理防止

5. **On-Demand Calendar Sync with Cache（API効率化）**
   - リアルタイムではなくユーザーが予約ページ開いた時点で同期
   - 15分キャッシュで無駄API削減（MVP規模で十分）
   - ユーザー100人超でcronバッチ切り替え検討

6. **Edge Functions for Scheduled Tasks（スケーラビリティ）**
   - 月次ポイント付与、リマインダー、サンキューメール
   - Supabase Edge Functions + pg_cronで実装
   - Next.jsデプロイと独立、サーバーレス実行

**プロジェクト構造:**
```
src/
├── app/(auth)(guest)(member)(admin)  # Route Groups で認証別分離
├── lib/
│   ├── availability/  # 空き時間計算
│   ├── booking/       # 予約オーケストレーション
│   ├── points/        # ポイント管理
│   ├── integrations/  # Google/Zoom/Resend ラッパー
│   └── supabase/      # DB クライアント
├── supabase/functions/  # Edge Functions
└── emails/              # React Email テンプレート
```

**データフロー（予約作成の例）**
1. ユーザーがスロット選択 → `GET /api/slots`でAvailability Calculator実行
2. Google Calendar同期（キャッシュ確認）→ 営業時間・既存予約・busy時間統合 → スロット生成
3. ユーザーが予約ボタン → `POST /api/bookings` Route Handler
4. Booking Manager: スロット再確認 → ポイント消費 → Zoom作成 → Calendar追加 → DB保存
5. 失敗時は補償処理実行（逆順巻き戻し）
6. メール送信は非同期（失敗しても予約は成立）

---

### PITFALLS.md から: 重大リスク & 緩和策

**15の落とし穴を3段階リスク分類:**

#### クリティカル（実装前に設計必須）:

1. **分散トランザクション補償処理欠如**
   - 影響: ポイント消費したのにZoomリンクがない等、不整合状態
   - 対策: Sagaパターン + 冪等性キー実装、テスト時に各ステップ失敗をモック化
   - Phase: 2（予約API実装前）に設計完了必須

2. **ポイントトランザクション整合性の破綻**
   - 影響: 同時予約で残高100から120ポイント消費可能（レースコンディション）
   - 対策: `SELECT FOR UPDATE NOWAIT` + 楽観的ロック（version）+ 並行リトライロジック
   - Phase: 1（DB設計）時点で`consume_points`関数に実装

3. **二重予約（ダブルブッキング）**
   - 影響: 同じ時間帯に2人予約成功
   - 対策: `bookings`テーブルにUNIQUE INDEX制約、UNIQUE違反エラーハンドリング、並行テスト（k6で100並行）
   - Phase: 1（DB設計）でUNIQUE INDEX追加

4. **OAuth トークン期限切れの未対応**
   - 影響: Zoom/Google Calendar APIが突然全て401エラー → サービス停止
   - 対策: リフレッシュトークン自動更新 + 5分前事前チェック + 並行リフレッシュ競合対策
   - Phase: 2（外部API統合設計）でリフレッシュフロー必須

#### 高リスク（実装段階で注視）:

5. **タイムゾーン不整合**
   - 影響: ユーザー、Google Calendar、DB、Zoomで時刻がズレる
   - 対策: 全てUTCで統一 + date-fns-tz で表示時のみJSTに変換 + タイムゾーン明示
   - Phase: 1（DB設計）で全カラム`timestamptz`に統一

6. **Google Calendar API Rate Limiting (10 QPS)**
   - 影響: 10人同時スロット取得で`403 Rate Limit Exceeded`、サービス停止
   - 対策: `app_settings`更新の排他制御（FOR UPDATE）+ Redisロック + エクスポーネンシャルバックオフ
   - Phase: 3（カレンダー同期）で排他制御実装、ユーザー20人超でcronバッチ切り替え

7. **Vercel Serverless 10秒タイムアウト（無料）**
   - 影響: 予約作成が10秒超でタイムアウト、不整合状態、ユーザー再試行で二重予約
   - 対策: 非同期処理分離（ポイント+DB同期、Zoom/Calendar/メール非同期）+ Vercel Pro検討（ユーザー10人超）
   - Phase: 2（アーキテクチャ設計）で非同期分離設計

8. **キャンセルポリシー実装漏れ**
   - 影響: 返還ルール曖昧 → ユーザー不満 + 運用負荷
   - 対策: ポリシー明示（24h: 100%、24h-3h: 50%、3h: 0%） + UI表示 + メール記載
   - Phase: 1（要件定義）で確定必須

#### 中リスク（運用検証が必要）:

9. **RLS パフォーマンス劣化**
   - 影響: admin が500件予約取得時、500回のEXISTS サブクエリで遅延
   - 対策: JWT claim ベースの権限チェック + SECURITY DEFINER関数 + インデックス追加
   - Phase: 2（RLS実装）でJWT claim設計

10. **メール送信失敗の未検知**
    - 対策: ロギング + リトライ（指数バックオフ）+ admin ダッシュボード可視化
    - Phase: 3（メール実装）

11. **Edge Function (Cron) 実行失敗**
    - 対策: ロギング外部保存 + Slack通知 + タイムゾーン明示 + 冪等性保証
    - Phase: 5（Cron実装）

12. **ゲスト予約のレートリミット未実装**
    - 対策: IP単位の Rate Limit（1時間5予約）+ メール単位制限 + reCAPTCHA v3
    - Phase: 3（ゲスト予約実装）

---

## ロードマップ含意

### 推奨フェーズ構成（5段階）

#### Phase 1: データベース・DB安全性設計（1-2週）
**目的:** トランザクション整合性とセキュリティの土台構築

**含むもの:**
- PostgreSQL スキーマ設計：`users`, `bookings`, `member_plans`, `point_transactions`, `point_logs`, `weekly_schedules`, `plans`, `menus`
- Stored Procedures: `consume_points()`, `refund_points()`, `cancel_booking()`に FOR UPDATE NOWAIT実装
- RLS ポリシー: JWT claim ベースの権限制御（admin, member, guest）
- インデックス・UNIQUE制約：二重予約防止、RLSパフォーマンス対策
- マイグレーション: UP + DOWN スクリプト定義、CI/CD自動化

**避けるリスク:**
- ❌ トランザクション設計なしでアプリケーション層に実装
- ❌ RLS なしでアプリ層アクセス制御
- ❌ UNIQUE制約なしでの二重予約対応

**成果物:**
- `supabase/migrations/001_initial_schema.sql` (300行)
- `supabase/migrations/002_stored_procedures.sql` (150行)

---

#### Phase 2: 認証 & 予約API骨組み（2-3週）
**目的:** Sagaパターンと冪等性を組み込んだ予約オーケストレーション

**含むもの:**
- Supabase Auth 統合（Google OAuth + Email/Password）
- Next.js Route Handler: `POST /api/bookings` (補償処理付き)
- Server Actions: `cancelBooking()`, `refundPoints()`
- 冪等性キー (Idempotency-Key) 実装、24時間キー保存
- リトライロジック (デッドロック時の指数バックオフ)
- キャンセルポリシー実装（時間ベース返還率）

**UI:**
- ログインページ
- 予約フロー UI（スロット選択、メニュー選択、確認）
- 会員ダッシュボード（予約一覧、キャンセル）

**避けるリスク:**
- ❌ Saga設計なしで外部API順序実装
- ❌ 冪等性キーなしでの再試行
- ❌ トランザクション管理なし

**成果物:**
- `lib/booking/create.ts` (200行、Saga設計)
- `app/api/bookings/route.ts` (100行)
- `app/(member)/dashboard/page.tsx`

---

#### Phase 3: 外部API統合（2-3週）
**目的:** Google Calendar、Zoom、Resend の統合、Rate Limit対策

**含むもの:**
- Google Calendar API: オンデマンド同期（15分キャッシュ）+ 排他制御（FOR UPDATE）
- Zoom API: アカウント A/B 切り替え + リフレッシュトークン自動更新
- Resend + React Email: 予約確認、キャンセル、リマインダーテンプレート
- レートリミット対策：Google Calendar 排他制御、Zoomリトライ、Resendエラーハンドリング
- ゲスト予約: IP単位 Rate Limit（Upstash Redis）

**リスク軽減:**
- RFC6585 429 Too Many Requests 実装
- OAuth トークン有効期限チェック（毎API呼び出し前）
- 外部APIエラーの統一フォーマット化 + ユーザーフレンドリーメッセージ

**避けるリスク:**
- ❌ リフレッシュトークン処理なし
- ❌ Rate Limit対策なし（並行制御）
- ❌ 外部APIエラーをそのままフロントに返す

**成果物:**
- `lib/integrations/google-calendar.ts`
- `lib/integrations/zoom.ts`
- `lib/integrations/email.ts`
- React Email テンプレート（Booking Confirmed, Reminder, Thank You等）

---

#### Phase 4: テスト & ポリッシング（2週）
**目的:** 本番環境への信頼性確保

**テスト:**
- ユニットテスト: `consume_points()` 関数の各シナリオ（成功、残高不足、デッドロック）
- 統合テスト: 予約作成全フロー（Saga成功・各ステップ失敗時補償）
- 負荷テスト: k6 で100並行予約（ダブルブッキング検出）、同時スロット取得（Rate Limit テスト）
- タイムゾーンテスト: UTC+9（JST）、UTC-5等異なるタイムゾーンからの予約確認

**品質:**
- TypeScript strict mode 有効化、ESLint Flat Config
- Prettier + Tailwind CSS v4 プラグイン
- `supabase gen types` CI/CD 自動化

**ユーザー検証:**
- ゲスト予約フロー（実際のメール送信確認）
- 会員予約フロー（ポイント消費確認）
- キャンセルフロー（ポイント返還確認）
- 祝日営業時間テスト

**避けるリスク:**
- ❌ トランザクション失敗シナリオのカバレッジ不足
- ❌ 並行テスト未実施
- ❌ 本番環境での初テスト

---

#### Phase 5: デプロイ & 運用準備（1週）
**目的:** 本番環境の可視性 & スケーリング準備

**含むもの:**
- Vercel デプロイ設定（環境変数管理、Edge Middleware）
- Supabase Edge Functions デプロイ：月次ポイント付与、リマインダー（pg_cron）
- ロギング & モニタリング：Sentry or Vercel Analytics + Slack 通知
- Admin ダッシュボード：予約統計、ポイント消費、メール送信状態、Cron実行履歴
- Runbook 作成：OAuth再認証手順、ロールバック手順、緊急連絡先

**スケーリング準備（検討段階）:**
- ユーザー20人超: Google Calendar cronバッチ化（5-10分ごと）
- ユーザー100人超: Supabase Pro + Vercel Pro 検討
- 週10件超の予約: Connection Pool 最適化、Read Replica検討

**避けるリスク:**
- ❌ 本番デプロイ後の環境変数紛失（`.env.local.example` 作成）
- ❌ Cron実行失敗の未検知（ロギング + Slack 通知必須）

---

### フェーズ別リスク警告表

| フェーズ | 最優先リスク | 検出方法 | 軽減開始時期 |
|---------|-----------|---------|-----------|
| Phase 1 | ポイント二重消費 | ユーザー報告「ポイント減りすぎ」 | 設計段階で FOR UPDATE |
| Phase 2 | 分散トランザクション不整合 | ユーザー「Zoom リンク無効」 | Saga設計 + テスト |
| Phase 3 | OAuth 期限切れサービス停止 | Vercelログ 401エラー頻発 | リフレッシュトークン実装 |
| Phase 3 | Google Calendar Rate Limit | ユーザー「予約画面真っ白」 | 排他制御 + バックオフ |
| Phase 4 | ダブルブッキング未検知 | 管理者「同じ時間2件予約」 | 並行テスト必須 |
| Phase 5 | Vercel 10秒タイムアウト | ユーザー「読み込み続ける」 | 非同期分離 or Pro移行 |
| Phase 5 | Edge Function 失敗未検知 | ユーザー「ポイント付与されない」 | ロギング + 通知 |

---

## 信頼度評価

| 領域 | 信頼度 | 根拠 | 検証方法 |
|------|--------|------|---------|
| **技術スタック** | **HIGH** | 公式ブログ、GitHub Releases、2026年2月時点のLTS確認 | STACK.md 多数ソース |
| **機能優先度** | **MEDIUM-HIGH** | 競合分析（Calendly, Acuity等）、業界標準機能レビュー | FEATURES.md 業界ベストプラクティス |
| **アーキテクチャパターン** | **HIGH** | Supabase 公式ドキュメント、Medium 記事、既存実装例 | ARCHITECTURE.md Medium + 公式 |
| **落とし穴・リスク** | **MEDIUM** | WebSearch + 公式ドキュメント + 既存CONCERNS.md検証 | PITFALLS.md 複数ソース検証 |
| **バージョン互換性** | **MEDIUM-HIGH** | npm Registry、GitHub Release notes（ただし2026年2月以降更新の可能性） | STACK.md レジストリ確認 |

**未検証領域:**
- Zoom API Server-to-Server OAuth の実装詳細（公式ドキュメント確認済みだが、実装例が限定的）
- Supabase RLS パフォーマンス at 1,000+ rows（小規模データでの動作は確認、大規模シミュレーション未実施）
- Google Calendar 15分キャッシュの運用実績（理論値で十分と判断、実運用データ不足）

---

## 研究ギャップと後続フェーズで解決すべき項目

### 確認すべき項目（着手前チェックリスト）

- [ ] Zoom A/B アカウント管理の実装詳細（OAuth 認証フロー）
- [ ] Supabase RLS & サーバーレス実行環境での SECURITY DEFINER 関数の動作確認
- [ ] Google Calendar API フリー枠での月間リクエスト上限（100万/日）の実運用確認
- [ ] Vercel Edge Middleware での Ratelimit (Upstash Redis) 接続安定性
- [ ] React Email 5.x の Next.js 15 App Router 互換性（実装段階で検証）

### 推奨リサーチフェーズ

**Phase 2 に `/gsd:research-phase` を検討する領域:**
1. Zoom Server-to-Server OAuth フロー（実装直前の詳細設計）
2. Supabase Edge Functions with pg_cron タイムゾーン設定（Cron実装前）
3. Google Calendar オンデマンド vs Cron バッチ切り替えの判断基準（ユーザー数スケール）

**標準パターン（リサーチ不要）:**
- Next.js 15 App Router の実装パターン（公式ドキュメント十分）
- PostgreSQL トランザクション基礎（Database Design Patterns 既知）
- Tailwind CSS 4 + shadcn/ui 統合（公式サポート充実）

---

## 情報ソース（集約）

### 高信頼度ソース（公式）
- [Next.js 15公式ブログ](https://nextjs.org/blog/next-15)
- [Supabase 公式ドキュメント（Edge Functions、RLS）](https://supabase.com/docs)
- [PostgreSQL 公式ドキュメント（トランザクション、ロック）](https://www.postgresql.org/docs)
- [Google Developers - OAuth ベストプラクティス](https://developers.google.com/identity/protocols/oauth2/resources/best-practices)
- [Zoom API Reference](https://developers.zoom.us/docs/api/)

### 中信頼度ソース（業界ベストプラクティス）
- [Medium - Architecture Patterns for Booking Systems](https://medium.com/)
- [Acuity Scheduling Learn](https://acuityscheduling.com/learn/)
- [Azure Architecture Center - Saga Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga)
- [Stripe API - Idempotency Keys](https://docs.stripe.com/api/idempotent_requests)

### 技術記事参考
- Supabase ベストプラクティス 2026
- PostgreSQL Stored Procedures for Point Management
- Building Real-Time Booking Systems with Next.js 14/15
- Rate Limiting in Next.js with Upstash Redis

---

## 実装推奨事項

### 最初の48時間で実施すべきこと
1. **DB スキーマ設計ワークショップ（4時間）** — ACID要件、RLS方針、マイグレーション戦略を確定
2. **Saga パターン ADR（Architectural Decision Record）作成（2時間）** — 各API統合ステップの補償処理を明示
3. **開発環境セットアップ（2時間）** — Supabase Local、Next.js Turbopack、ESLint Flat Config
4. **Phase 1 タスク分解（3時間）** — DB設計タスクを日単位で分割

### 開発中に守るべき原則
- **KISS（Keep It Simple, Stupid）** — 複雑な非同期処理は後回し、シンプルな同期実装から開始
- **YAGNI（You Aren't Gonna Need It）** — 複数コーチ対応、リッチテキストエディタなど早期に実装しない
- **DRY（Don't Repeat Yourself）** — トランザクション処理は PostgreSQL 関数に一元化、アプリケーション層での重複実装回避

---

## 次ステップ

1. **このSUMMARY.mdをロードマップチームに共有** — 5フェーズ構成、各フェーズのリスク警告を念頭にした要件定義
2. **Phase 1 設計レビュー** — DB スキーマ、Stored Procedures、RLS ポリシーの技術レビュー（不明点がある場合は `/gsd:research-phase` 検討）
3. **ステークホルダー合意** — キャンセルポリシー、Zoomアカウント使い分けロジックの最終確認（ビジネス決定）
4. **開発チーム個別面談** — 前述の15の落とし穴の把握、特にPhase 2-3でのリスク対応について確認

---

**研究完了:** 2026-02-22
**統合信頼度:** HIGH
**ロードマップ作成準備:** 完了 ✓
