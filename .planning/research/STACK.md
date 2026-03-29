# 技術スタックリサーチ

**ドメイン:** コーチングセッション予約システム（ポイント制サブスクリプション）
**調査日:** 2026-03-27
**全体信頼度:** HIGH

---

## v1.3 運用改善 — 新規スタック追加分

このセクションは v1.3 マイルストーン用。**既存スタックへの新規ライブラリ追加はゼロ。**
DB スキーマ変更と既存ライブラリの活用のみで4機能すべて実装できる。

### 結論: 新規 npm パッケージのインストール不要

v1.3 の4機能は、すべて以下の既存リソースで実装可能。

| 機能 | 使用する既存リソース |
|------|-------------------|
| Zoom カレンダーブロック | 既存 `zoom.ts` の `getZoomAccessToken()` + 新規 fetch |
| プランタイプ別メニュー表示 | DB マイグレーション（`meeting_menus` にカラム追加）のみ |
| ポイント溢れ通知メール | 既存 Edge Function パターン + pg_cron + 既存 `resend` |
| 会員アクティビティ表示 | 既存 `bookings` テーブルへの集計クエリのみ |

---

## 1. Zoom カレンダーブロック (#12)

### 使用 API エンドポイント

**`GET https://api.zoom.us/v2/users/me/meetings?type=scheduled`**

既存の `getZoomAccessToken(accountType)` で取得したトークンをそのまま使う。
新しい認証処理は不要。

```typescript
// 既存の zoom.ts に関数を追加するだけ
// アカウント A / B それぞれで呼び出す
const response = await fetch(
  'https://api.zoom.us/v2/users/me/meetings?type=scheduled&page_size=300',
  {
    headers: { Authorization: `Bearer ${accessToken}` }
  }
)
```

### レスポンス構造（確認済み）

```typescript
interface ZoomScheduledMeetingsResponse {
  meetings: Array<{
    id: number
    topic: string
    type: number        // 2 = Scheduled
    start_time: string  // ISO 8601, UTC
    duration: number    // minutes
    timezone: string
  }>
  total_records: number
  next_page_token?: string  // ページネーション用
}
```

**重要:** `start_time` は ISO 8601 UTC 形式。`duration` (分) を加算して end_time を計算する必要がある。
`end_time` フィールドはレスポンスに含まれないため、`start_time + duration` で算出する。

### 既存コードとの統合ポイント

- `getAdminBusyTimes()` が呼ぶ `freebusy` の返却形式（`{ start, end }[]`）と統一
- Zoom の BusyTime を Google Calendar の BusyTime と同じ `BusyTime[]` 型にマッピングして統合する
- 15分キャッシュは既存の `LRUCache` パターンをそのまま流用

### 必要な OAuth スコープ

Server-to-Server OAuth アプリに `meeting:read:list_meetings:admin` スコープが必要。
**既存の Zoom S2S OAuth アプリのスコープ設定を確認・更新する作業が発生する。**
（ミーティング作成時の `meeting:write` とは別スコープ）

| スコープ | 必要理由 |
|---------|---------|
| `meeting:read:list_meetings:admin` | `GET /users/me/meetings` の呼び出し権限 |
| `meeting:write:admin` | 既存。ミーティング作成・削除 |

### 信頼度

**MEDIUM** — エンドポイント構造とフィールドは Zoom 公式 API リファレンスで確認。
スコープ名は公式ドキュメントの直接確認は取れていないが（ページがJS難読化）、
フォーラムおよびコミュニティ記事複数件で `meeting:read` 系が必要と確認。
実装前に Zoom Developer Console で実際のスコープ付与テストを推奨。

---

## 2. プランタイプ別メニュー表示 (#10)

### アプローチ: DB カラム追加のみ

新しいテーブルは不要。`meeting_menus` テーブルに可視性制御カラムを追加するのが最もシンプル。

**推奨設計（KISS 原則）:**

```sql
-- meeting_menus テーブルに追加
ALTER TABLE meeting_menus
  ADD COLUMN visible_to TEXT NOT NULL DEFAULT 'all'
  CHECK (visible_to IN ('all', 'member_only', 'guest_only'));
```

- `'all'` — 全員に表示（デフォルト。既存メニューは移行不要）
- `'member_only'` — 会員のみ（ポイント消費メニュー）
- `'guest_only'` — ゲストのみ（カジュアル30分セッション）

### 代替案（採用しない）

| 案 | 却下理由 |
|----|---------|
| `plan_id[]` 配列で許可プラン列挙 | プランが増えるたびに全メニュー更新が必要。over-engineering |
| 中間テーブル `menu_plan_visibility` | 3プランしかない現規模で不要。JOIN コスト増 |
| `is_guest_visible` / `is_member_visible` 2カラム | `visible_to` 1カラムの方が意図が明確 |

### フロントエンド統合

```typescript
// 既存の getAvailableMenus() に where 条件を追加するだけ
const visibleTo = isLoggedInMember ? ['all', 'member_only'] : ['all', 'guest_only']
.in('visible_to', visibleTo)
```

**新規ライブラリ不要。**

---

## 3. ポイント溢れ通知メール (#9)

### アプローチ: 新規 Edge Function + pg_cron

既存の `monthly-point-grant` Edge Function と同一パターンで実装する。

### pg_cron スケジュール設定（確認済み）

```sql
-- 毎月20日 JST 10:00 = UTC 01:00 に実行
SELECT cron.schedule(
  'point-overflow-notification',
  '0 1 20 * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
      || '/functions/v1/point-overflow-notification',
    headers := jsonb_build_object(
      'Content-type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

**JST 考慮が必要:** Supabase pg_cron は UTC で動作する。JST 10:00 = UTC 01:00。

### 溢れ検出ロジック（DBクエリのみ）

```sql
-- 次月1日付与後に max_points を超過する会員を検出
SELECT
  mp.user_id,
  p.email,
  mp.current_points,
  pl.monthly_points,
  pl.max_points,
  (mp.current_points + pl.monthly_points) AS projected_balance,
  (mp.current_points + pl.monthly_points - pl.max_points) AS overflow_amount
FROM member_plans mp
JOIN plans pl ON mp.plan_id = pl.id
JOIN profiles p ON mp.user_id = p.id
WHERE mp.status = 'active'
  AND pl.max_points IS NOT NULL
  AND (mp.current_points + pl.monthly_points) > pl.max_points;
```

### メール送信

既存の `Resend` + `React Email` をそのまま使う。
新規メールテンプレートコンポーネント1つを追加するだけ。

**新規ライブラリ不要。**

### 信頼度

**HIGH** — Supabase 公式ドキュメントで `0 1 20 * *` 構文と pg_net 統合を確認。
既存 `monthly-point-grant` が同一パターンで稼働実績あり。

---

## 4. 会員アクティビティ表示 (#8)

### アプローチ: 集計クエリのみ

新規テーブル不要。`bookings` テーブルの `start_time` から直接算出する。

### 必要なクエリ

```sql
-- 会員の最終訪問日と未訪問日数を取得
SELECT
  mp.user_id,
  MAX(b.start_time) AS last_session_at,
  EXTRACT(DAY FROM (NOW() - MAX(b.start_time))) AS days_since_last_session
FROM member_plans mp
LEFT JOIN bookings b ON b.member_plan_id = mp.id
  AND b.status = 'completed'
GROUP BY mp.user_id;
```

### 色分けロジック（フロントエンド）

| 状態 | 条件 | 表示 |
|------|------|------|
| アクティブ | `days < 30` | 通常（色なし） |
| 注意 | `30 <= days < 60` | 黄色バッジ |
| 非アクティブ | `days >= 60` | 赤バッジ |
| セッション未実施 | `last_session_at IS NULL` | グレー |

### 既存コードとの統合

- `getMembers()` の SQL クエリに LEFT JOIN を追加して `last_session_at` を取得
- shadcn/ui の `Badge` コンポーネント（既存）で色分けバッジを表示
- ダッシュボード用には別途集計クエリを Server Action として追加

**新規ライブラリ不要。**

---

## スタック変更サマリー

### 新規追加: ゼロ

v1.3 で新しく `npm install` するパッケージはない。

### DB マイグレーション: 2件（推定）

| マイグレーション | 変更内容 |
|----------------|---------|
| `meeting_menus` カラム追加 | `visible_to TEXT DEFAULT 'all'` |
| pg_cron ジョブ追加 | `point-overflow-notification` スケジュール登録 |

### Edge Function: 1件追加

| Function | トリガー | 用途 |
|---------|---------|------|
| `point-overflow-notification` | pg_cron 毎月20日 UTC 01:00 | 溢れ予定会員へのメール送信 |

### 既存コード変更: 最小限

| ファイル | 変更内容 |
|---------|---------|
| `src/lib/integrations/zoom.ts` | `getZoomScheduledMeetings()` 関数を追加 |
| `src/lib/integrations/google-calendar.ts` | `getCachedBusyTimes()` に Zoom busy times を統合 |
| `src/lib/actions/admin/members.ts` | `getMembers()` クエリに `last_session_at` 取得を追加 |

---

## 採用しないもの

| 却下 | 理由 |
|------|------|
| Zoom Calendar SDK / `@zoom/rivet-sdk` | Server-to-Server OAuth の fetch で十分。SDK は over-engineering |
| `date-fns-tz` | 既存 `date-fns` v4 に timezone サポートが統合済み |
| `node-cron` / `bull` | Supabase pg_cron が既存稼働中。二重管理になる |
| 中間テーブル `menu_plan_visibility` | 現規模3プランに不要。`visible_to` カラムで十分 |
| `react-query` / `swr` | App Router の Server Components + Server Actions で十分 |

---

## バージョン互換性（v1.3 関連）

| パッケージ | 現行バージョン | v1.3 での変更 |
|-----------|-------------|-------------|
| `googleapis` | `^171.4.0` | 変更なし |
| `lru-cache` | `^11.2.6` | 変更なし（Zoom busy times キャッシュに流用） |
| `resend` | `^6.9.2` | 変更なし |
| `@react-email/components` | `^1.0.8` | 変更なし（新テンプレート追加のみ） |
| `date-fns` | `^4.1.0` | 変更なし（`addMinutes()` で Zoom end_time 算出に使用） |

---

## インストール

```bash
# v1.3 は新規パッケージなし
# 既存パッケージで全機能を実装する
```

---

## 信頼度評価

| 領域 | 信頼度 | 根拠 |
|------|--------|------|
| Zoom `GET /users/me/meetings` エンドポイント | **MEDIUM** | zoom.github.io/api 公式参考 + Zoom Developer Forum 複数件で確認。ただし現行公式ドキュメントページが JS 難読化のため直接確認できず |
| Zoom レスポンスフィールド（`start_time`, `duration`） | **MEDIUM** | Developer Forum の実際の API レスポンス例から確認。`end_time` 非存在も確認済み |
| Zoom OAuth スコープ `meeting:read:list_meetings:admin` | **LOW** | スコープ名はコミュニティ記事から推定。Developer Console で実際に確認必要 |
| pg_cron `0 1 20 * *` 構文 | **HIGH** | Supabase 公式ドキュメントで構文確認。既存 `monthly-point-grant` パターンが稼働実績あり |
| `meeting_menus.visible_to` カラム設計 | **HIGH** | 既存スキーマ把握済み。KISS 原則に基づく最小変更 |
| 会員アクティビティ集計クエリ | **HIGH** | 既存 `bookings` テーブルスキーマ把握済み。標準 SQL |

---

## 情報ソース

### v1.3 新規調査（2026-03-27）

- [Zoom API 公式参考 (zoom.github.io)](https://zoom.github.io/api/#get-users-meetings) — `GET /users/{userId}/meetings` エンドポイント構造
- [Zoom Developer Forum - Get scheduled meetings](https://devforum.zoom.us/t/get-users-meetings-meetings-past-instances-and-past-meeting-instances-participants/37995) — MEDIUM 信頼度
- [Supabase Schedule Functions 公式ドキュメント](https://supabase.com/docs/guides/functions/schedule-functions) — pg_cron + pg_net 統合パターン、`0 0 20 * *` 構文
- [Supabase pg_cron 公式ドキュメント](https://supabase.com/docs/guides/database/extensions/pg_cron) — cron 構文確認

### 既存スタック調査（v1.0〜v1.2、再確認不要）

- [Next.js 公式ドキュメント](https://nextjs.org/docs) — App Router パターン
- [Supabase Edge Functions 公式](https://supabase.com/docs/guides/functions) — Edge Function パターン
- 既存コードベース（`zoom.ts`, `google-calendar.ts`, `monthly-point-grant/index.ts`）— 実装パターン確認

---

## v1.0〜v1.2 確定済みスタック（参照のみ）

以下は v1.2 まで確定済み。v1.3 での変更なし。

### コア技術

| 技術 | バージョン | 用途 |
|------|----------|------|
| Next.js | 15.x | フルスタックフレームワーク（App Router） |
| React | 19.x | UI ライブラリ |
| TypeScript | 5.x | 型安全性 |
| Supabase | マネージド | BaaS (PostgreSQL + Auth + Edge Functions) |
| @supabase/supabase-js | 2.97.0 | Supabase クライアント |
| Vercel | マネージド | ホスティング |

### UI / スタイリング

| 技術 | バージョン | 用途 |
|------|----------|------|
| shadcn/ui | 最新 CLI | UI コンポーネント |
| Tailwind CSS | 4.x | ユーティリティ CSS |
| Radix UI | `radix-ui` 統合 | アクセシブルプリミティブ |

### サポートライブラリ

| ライブラリ | バージョン | 用途 |
|----------|----------|------|
| Zod | 4.x | スキーマ検証 |
| date-fns | 4.x | 日時操作 |
| googleapis | 171.x | Google Calendar API |
| resend | 6.x | メール送信 |
| @react-email/components | 1.x | メールテンプレート |
| lru-cache | 11.x | API レスポンスキャッシュ |

### テスト

| ライブラリ | バージョン | 用途 |
|----------|----------|------|
| @playwright/test | 1.58.2 | E2E テスト |
| vitest | 4.x | 単体テスト |
| @testing-library/react | 16.x | コンポーネントテスト |

---

*スタックリサーチ更新: v1.3 運用改善 新規スタック調査追加*
*更新日: 2026-03-27*
*調査担当: GSD Project Researcher*
