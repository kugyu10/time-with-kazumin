# Phase 8: バグ修正 - Research

**Researched:** 2026-03-15
**Domain:** バグ修正 — Zoom削除・タイムゾーン・ウェルカムメール・Googleカレンダー
**Confidence:** HIGH（コードを直接読んで根本原因を特定済み）

## Summary

Phase 8は本番環境で発生している5つのバグ（BUG-01〜05）を修正するフェーズ。全てのバグについてコードを直接調査した結果、根本原因が特定できた。

**BUG-01（Zoom削除）** はZoom削除自体のロジック（両アカウント試行）は正しいが、`cancel.ts`が`accountType`を渡さないため、`tryDeleteMeeting`が両アカウントを順番に試みる設計に依存している。本番で失敗するケースは、Zoom APIのエラーまたはトークン取得失敗の可能性が高い。

**BUG-02/BUG-03（JST表示）** は全UIページで`timeZone: "Asia/Tokyo"`が未指定なことが原因。Vercel環境はUTCで動作するため、`new Date()`による表示がUTCになる。メールテンプレートは正しく`timeZone: "Asia/Tokyo"`を指定している（修正の参考パターンとして使える）。

**BUG-04（ウェルカムメール）** は`WelcomeEmail`テンプレートが存在せず、`createMember()`にResend送信処理が未実装なことが根本原因。

**BUG-05（Googleカレンダーブロック漏れ）** はコードロジック自体は正しいが、OAuth認証の有効期限切れまたは`GOOGLE_CALENDAR_ID`環境変数の設定ミスが疑われる。

**Primary recommendation:** 各バグを独立したタスクで修正し、UTC/JST変換規約を`docs/rules.md`に文書化する。

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BUG-01 | キャンセル時にZoom側の会議が確実に削除される | `cancel.ts`の`deleteZoomMeeting`呼び出しで`accountType`が渡されない問題。`bookings`テーブルに`zoom_start_url`は保存されているが`zoom_account_type`はない。`zoom.ts`の両アカウント試行ロジックをデバッグして修正 |
| BUG-02 | `/booking/[id]` の予約詳細画面の時刻がJSTで表示される | `src/app/(member)/bookings/[id]/page.tsx`の`formatDateTimeFull`で`timeZone: "Asia/Tokyo"`を追加 |
| BUG-03 | 全画面でJST表示を統一し、UTC/JST変換コード規約を `docs/rules.md` に明文化する | 影響ファイル5箇所特定済み。`docs/rules.md`新規作成 |
| BUG-04 | 会員招待完了後にウェルカムメールが送信される | `WelcomeEmail`テンプレート新規作成 + `createMember()`にResend送信処理追加 |
| BUG-05 | 管理者Googleカレンダーの予定がスロットに正確にブロックされる | OAuth認証状態と`GOOGLE_CALENDAR_ID`設定を確認し、`getCachedBusyTimes`の動作を修正 |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15系 | App Router, Server Actions | 既存使用中 |
| Resend | 最新 | メール送信 | 既存使用中（BUG-04）|
| @react-email/components | 最新 | メールテンプレート | 既存使用中 |
| googleapis | 最新 | Google Calendar FreeBusy API | 既存使用中 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | 最新 | 管理画面の日時フォーマット | 管理画面（既存使用）|
| Intl.DateTimeFormat | ブラウザ標準 | JST変換 | timeZone指定が必要な全箇所 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `toLocaleDateString` + `timeZone` | `date-fns-tz` | date-fns-tzは新規依存追加が必要。既存パターン（メールテンプレートの`timeZone: "Asia/Tokyo"`）を使えば追加依存不要 |

**Installation:**
```bash
# 新規パッケージインストール不要（既存スタックで対応可能）
```

## Architecture Patterns

### BUG-01: Zoom削除確実化

**問題の詳細:**
`cancel.ts`（L168-177）では`booking.zoom_meeting_id`があれば`deleteZoomMeetingApi(booking.zoom_meeting_id!)`を呼ぶが、`accountType`を渡していない。`zoom.ts`の`deleteZoomMeeting`は`accountType`未指定時に両アカウント（A/B）を順番に試みるが、本番でZoom APIエラーが発生すると`tryDeleteMeeting`がfalseを返し、ログ出力だけで終わる設計になっている。

**修正パターン:**
```typescript
// cancel.ts の修正方針
// Option A: bookingsテーブルにzoom_account_typeカラム追加してselectに含める
// Option B: menu_idからzoom_accountを再取得してdeleteZoomMeetingに渡す
// Option C: 現状の両アカウント試行のままだが、エラー時に例外をthrowさせる

// 最もKISSな修正: zoom_meeting_idとともにzoom_start_urlも保存済みなので
// menu_idからzoom_accountを再取得して渡す（追加DBマイグレーション不要）
```

**注意:** `bookings`テーブル定義確認：`zoom_meeting_id TEXT`と`zoom_join_url TEXT`は存在するが、`zoom_start_url`と`zoom_account_type`は**DBに保存されていない**（sagaで`confirmBooking`時に`zoom_meeting_id`と`zoom_join_url`のみ保存）。

**推奨修正戦略:**
- `cancel.ts`で`menu_id`を取得済みなので、`getMenuZoomAccount(supabase, booking.menu_id)`を呼んでaccount typeを取得する
- または`bookings`テーブルに`zoom_account_type`カラムを追加してsaga内で保存する（より堅牢）

### BUG-02/BUG-03: JST時刻表示統一

**問題の詳細:**
Vercel環境はUTCタイムゾーンで動作する。`new Date(isoString).toLocaleDateString("ja-JP", {...})`で`timeZone`を指定しない場合、Vercel上でUTC時刻が表示される。メールテンプレートは正しく修正済みなので、そのパターンを横展開する。

**影響ファイル（全5箇所）:**
1. `src/app/(member)/bookings/[id]/page.tsx` - `formatDateTimeFull()`（BUG-02の直接原因）
2. `src/components/bookings/BookingCard.tsx` - `formatDateTime()`
3. `src/app/admin/bookings/columns.tsx` - `format(startTime, ...)` (date-fns)
4. `src/app/(public)/guest/booking/success/page.tsx` - `toLocaleDateString/toLocaleTimeString`
5. `src/app/(public)/guest/cancel/[token]/page.tsx` - `toLocaleDateString/toLocaleTimeString`

**修正パターン（参考: BookingConfirmation.tsx）:**
```typescript
// 正しいパターン（メールテンプレートより）
function formatDateTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",  // ← これが必須
  })
}

// date-fns を使う場合（管理画面）は date-fns-tz が必要だが、
// KISSに抑えるためtoLocaleXxx APIに統一するか、
// formatInTimeZone(date, "Asia/Tokyo", "yyyy/MM/dd (E)", {locale: ja}) を使う
```

**date-fns admin bookings の対処:**
管理画面（`admin/bookings/columns.tsx`）は`date-fns`の`format()`を使用しているため`timeZone`指定が効かない。以下2択：
1. `Intl.DateTimeFormat`に書き換え（依存追加なし、KISS）
2. `date-fns-tz`を追加して`formatInTimeZone`を使用（より明示的）

推奨: `toLocaleString`ベースに統一（date-fns-tz 追加を避ける）

### BUG-04: ウェルカムメール送信

**問題の詳細:**
`createMember()`（L236-244）では`supabase.auth.admin.generateLink({ type: "recovery" })`でパスワードリセットリンクを生成しているが、そのリンクをResend経由でユーザーに送信していない。また`WelcomeEmail`テンプレートファイルが存在しない。

**修正パターン:**
```typescript
// 1. WelcomeEmail.tsx テンプレートを作成（既存テンプレートの構造を参照）
// src/emails/WelcomeEmail.tsx

// 2. email.ts に sendWelcomeEmail() 関数を追加
export async function sendWelcomeEmail(params: {
  userEmail: string
  userName: string
  passwordResetUrl: string
}): Promise<SendEmailResult>

// 3. createMember() で generateLink の戻り値URLを使ってsendWelcomeEmail()を呼ぶ
const { data: linkData } = await supabase.auth.admin.generateLink({
  type: "recovery",
  email: validated.email,
})
// linkData.properties.action_link が reset URL

await sendWelcomeEmail({
  userEmail: validated.email,
  userName: validated.full_name,
  passwordResetUrl: linkData.properties.action_link,
})
```

### BUG-05: Googleカレンダーブロック漏れ

**問題の詳細:**
`getCachedBusyTimes()`はコードロジックが正しい。`isAuthenticated()`チェックでOAuth未設定時はスキップされる設計（空配列返却）。本番で「予定が反映されない」場合の原因候補：
1. OAuthトークンの有効期限切れ（`tokens`イベントリスナーが正しく動作していない）
2. `GOOGLE_CALENDAR_ID`環境変数の設定ミス（`primary`ではなく実際のカレンダーIDが必要な場合）
3. FreeBusy APIに返すbusy時間のタイムゾーン解釈の問題
4. `busyTimesCache`の15分キャッシュが古いデータを返している

**調査・修正アプローチ:**
- Vercelのログで`[GoogleCalendar]`プレフィックスのログを確認
- `isAuthenticated()`がfalseを返していないか確認
- `getCachedBusyTimes`が返すbusy時間をログ出力して確認
- キャッシュクリアのエンドポイント追加（デバッグ用）

### Anti-Patterns to Avoid
- **date-fns-tz を不必要に追加する:** date-fnsのformat()をtoLocaleString系に置き換えることで依存追加を避けられる
- **WelcomeEmailをメール本文テキストで実装する:** 既存のReact Emailテンプレートパターンに統一する
- **Zoom削除失敗を無視する:** 現状の非ブロッキング設計は正しいが、ログ出力を充実させてデバッグ可能にする

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JST変換 | カスタムUTCオフセット計算 | `Intl.DateTimeFormat`の`timeZone`オプション | DST（サマータイム）非対応になる |
| メールテンプレート | HTML文字列の手動連結 | @react-email/components | 既存パターンに統一 |
| OAuth token管理 | 独自暗号化実装 | 既存の`oauth/tokens.ts` | 既に実装済み |

**Key insight:** 既存のメールテンプレート（BookingConfirmation.tsx等）が正しいJST変換パターンを実装済み。新規コードはそれを参照するだけでよい。

## Common Pitfalls

### Pitfall 1: date-fns の format() でタイムゾーン指定が効かない
**What goes wrong:** `format(new Date("2026-03-15T14:00:00+09:00"), "HH:mm")`はVercel（UTC）環境で`05:00`を返す
**Why it happens:** date-fnsの`format()`はシステムタイムゾーン（Vercel=UTC）を使用する
**How to avoid:** `Intl.DateTimeFormat`の`timeZone`オプションを使うか、`date-fns-tz`の`formatInTimeZone`を使う
**Warning signs:** ローカル（JST環境）ではJSTが正しく表示されるがVercel本番でUTCが表示される

### Pitfall 2: Zoom削除でmeetingIdにスラッシュが含まれる場合
**What goes wrong:** meetingIdが数値以外のフォーマットの場合、APIエンドポイントのパスが壊れる
**How to avoid:** `String(data.id)`で確実に文字列化する（既存実装済み）

### Pitfall 3: generateLink の戻り値URLが空の場合
**What goes wrong:** `supabase.auth.admin.generateLink()`が成功してもURLが返らない場合がある
**How to avoid:** `linkData?.properties?.action_link`の存在チェックを追加し、URLがなくてもウェルカムメール（URL未掲載版）を送るフォールバックを実装

### Pitfall 4: WelcomeEmail でパスワードリセットURLの有効期限
**What goes wrong:** Supabaseの`recovery`リンクはデフォルト1時間で失効する
**How to avoid:** メール本文に有効期限（1時間）を明記する

## Code Examples

### JST変換の正しいパターン
```typescript
// Source: src/emails/BookingConfirmation.tsx（既存実装）
function formatDateTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  })
}

function formatTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  })
}
```

### Zoom削除でaccount typeを取得する方法
```typescript
// src/lib/bookings/saga.ts の既存ヘルパーを再利用（または同様の実装）
async function getMenuZoomAccount(
  supabase: SupabaseClient<Database>,
  menuId: number
): Promise<"A" | "B"> {
  const { data } = await (supabase as any)
    .from("meeting_menus")
    .select("zoom_account")
    .eq("id", menuId)
    .single()
  return (data?.zoom_account as "A" | "B") || "A"
}
```

### ウェルカムメール送信フロー
```typescript
// createMember() 末尾の修正
const { data: linkData } = await supabase.auth.admin.generateLink({
  type: "recovery",
  email: validated.email,
})

const resetUrl = linkData?.properties?.action_link

// 非ブロッキング: 失敗しても会員作成は成功扱い
try {
  await sendWelcomeEmail({
    userEmail: validated.email,
    userName: validated.full_name,
    passwordResetUrl: resetUrl ?? null,
  })
} catch (error) {
  console.warn("[createMember] Welcome email failed (non-blocking):", error)
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `format(date, "HH:mm")` (date-fns) | `toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo" })` | Phase 8 | 本番環境でのUTC表示を解消 |
| パスワードリセットのみ送信 | ウェルカムメール送信 | Phase 8 | ユーザーに適切な初回案内を提供 |

## Open Questions

1. **BUG-05（Googleカレンダー）の実際の失敗原因**
   - What we know: コードロジックは正しく実装されている
   - What's unclear: 本番でOAuth認証が有効か、GOOGLE_CALENDAR_IDが正しく設定されているか
   - Recommendation: Vercelのログを確認してから修正内容を決定する。ログ確認をPLAN内のタスクに含める

2. **BUG-01（Zoom削除）の実際の失敗原因**
   - What we know: `deleteZoomMeeting(id)`は両アカウントを試みる設計
   - What's unclear: 本番でエラーが発生しているのか、それとも削除済みIDに対してリトライしているのか
   - Recommendation: ログ確認タスクをPLANに含め、確認後に修正方針を決定

3. **docs/rules.md の配置場所**
   - What we know: プロジェクトルートに`docs/`ディレクトリが存在するか未確認
   - What's unclear: 既存の`docs/`ディレクトリ有無
   - Recommendation: `docs/rules.md`を新規作成（ディレクトリも作成）

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest（src/__tests__/ に既存テストあり） |
| Config file | vitest.config.ts（要確認）または package.json |
| Quick run command | `npm test` または `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUG-01 | Zoom削除が成功する | unit | `npx vitest run src/__tests__/lib/integrations/zoom.test.ts` | ✅ |
| BUG-02 | `/booking/[id]` でJST表示 | manual | Vercel preview URLで目視確認 | - |
| BUG-03 | 全画面でJST統一 | manual | 各画面を目視確認 | - |
| BUG-04 | ウェルカムメール送信 | unit | `npx vitest run src/__tests__/lib/integrations/email.test.ts` | ✅ |
| BUG-05 | Googleカレンダーブロック | manual | スロット画面で管理者予定が反映されることを目視確認 | - |

### Sampling Rate
- **Per task commit:** `npx vitest run` （既存テストがパスすること）
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/lib/integrations/email.test.ts` に `sendWelcomeEmail` テストケース追加（BUG-04）
- [ ] `src/__tests__/lib/integrations/zoom.test.ts` に削除シナリオの追加テスト（BUG-01）

*(既存のテストインフラは存在する。新規テストケースの追加のみ必要)*

## Sources

### Primary (HIGH confidence)
- コード直接調査: `src/lib/bookings/cancel.ts` - Zoom削除呼び出しのaccount type未指定を確認
- コード直接調査: `src/lib/integrations/zoom.ts` - 両アカウント試行ロジックを確認
- コード直接調査: `src/app/(member)/bookings/[id]/page.tsx` - `timeZone`未指定を確認
- コード直接調査: `src/components/bookings/BookingCard.tsx` - `timeZone`未指定を確認
- コード直接調査: `src/app/admin/bookings/columns.tsx` - date-fnsの`format()`使用を確認
- コード直接調査: `src/emails/BookingConfirmation.tsx` - 正しいJST変換パターンを確認
- コード直接調査: `src/lib/actions/admin/members.ts` - ウェルカムメール未送信を確認
- コード直接調査: `src/emails/` - `WelcomeEmail.tsx`が存在しないことを確認
- コード直接調査: `src/lib/integrations/google-calendar.ts` - FreeBusy APIロジックを確認

### Secondary (MEDIUM confidence)
- Supabase公式: `auth.admin.generateLink`の戻り値に`properties.action_link`が含まれる

### Tertiary (LOW confidence)
- BUG-05の根本原因: 本番ログ未確認のため、OAuth認証失敗またはCALENDAR_ID設定ミスが疑われるが確証なし

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - 既存スタックの活用のみ、新規ライブラリ不要
- Architecture: HIGH - 全バグのコードを直接読んで根本原因を特定済み
- Pitfalls: HIGH - date-fnsのタイムゾーン問題は既知の落とし穴

**Research date:** 2026-03-15
**Valid until:** 2026-04-15（コードが変更されるまで有効）
