# Phase 13: Zoomカレンダーブロック - Research

**Researched:** 2026-03-28
**Domain:** Zoom API スケジュール取得 + LRUCacheキャッシュ + busyTimesマージ + Saga統合
**Confidence:** MEDIUM（Zoom APIレスポンス型はフォーラム情報、エラー3161の無料アカウント挙動は実機未確認）

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** ミーティング一覧取得関数 `getZoomScheduledMeetings()` を既存の `src/lib/integrations/zoom.ts` に追加する。トークン取得やエラーハンドリングを再利用。

**D-02:** ZOOM_AとZOOM_Bのスケジュール取得は `Promise.allSettled` で並列実行する。片方が失敗してももう片方の結果は使える。

**D-03:** Zoomのビジー時間をGoogle CalendarのbusyTimes配列にマージし、既存の `isSlotBusy()` をそのまま使う。変更箇所を最小化。

**D-04:** `/api/public/slots` と `/api/public/slots/week` の両方に反映する。

**D-05:** 予約確定時のZoomリアルタイム確認は `saga.ts` のフローにステップを追加する。Zoom会議作成前にスケジュール確認し、競合時はエラー返却。

**D-06:** Google Calendarと同じ `LRUCache` パターンで15分TTLのキャッシュを実装する。

**D-07:** 予約確定時（saga.ts内）はキャッシュをバイパスしてリアルタイムでZoom APIを叩く。

**D-08:** ZOOM_B（無料アカウント）がエラー3161を返した場合、空配列を返却し `console.warn` でログ記録する。予約フローは止めない。

**D-09:** 実機確認（ZOOM_BでGET /users/me/meetings をcurl実行）はデプロイ後に行う。先にフォールバック込みで実装を完了させる。

### Claude's Discretion

- Zoom APIレスポンスの型定義の詳細
- busyTimesマージの具体的な実装方法（配列concat + 重複除去 or そのまま追加）
- saga.tsへの追加ステップの具体的な位置（補償トランザクションとの整合）
- Zoomスケジュール取得のページネーション処理（30日以内の予定数が少ない場合は不要の可能性）

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ZOOM-01 | ZOOM_Aのスケジュール済みミーティングを空き時間判定でブロック対象にできる | D-01, D-02, D-03, D-04: getZoomScheduledMeetings(A) → BusyTime変換 → busyTimesマージ → isSlotBusy() |
| ZOOM-02 | ZOOM_BのスケジュールされたミーティングをZoom時間判定でブロック対象にできる | D-01, D-02, D-03, D-04: getZoomScheduledMeetings(B) → BusyTime変換（エラー3161フォールバックあり） |
| ZOOM-03 | Zoomスケジュール取得結果を15分キャッシュで効率化する（スロット一覧表示用） | D-06: LRUCache 15分TTL、既存getCachedBusyTimesと同パターン |
| ZOOM-04 | 予約確定時はキャッシュを無視しZoomスケジュールをリアルタイムで再確認する | D-05, D-07: saga.ts Step 5前にキャッシュバイパスしてリアルタイム確認 |
</phase_requirements>

---

## Summary

本フェーズは、バックエンドのみの変更でZoom_AおよびZoom_Bのスケジュール済みミーティングを空き枠判定に反映する。UIの変更は不要。

既存の `zoom.ts` に `getZoomScheduledMeetings(accountType)` 関数を追加し、Zoom API `GET /users/me/meetings?type=scheduled` でスケジュール取得する。取得した meetings 配列の `start_time`（ISO 8601）と `duration`（分単位の整数）から `BusyTime` 型（`{ start: string; end: string }`）に変換し、既存 Google Calendar の `busyTimes` 配列にマージする。`isSlotBusy()` は変更不要。

キャッシュは `LRUCache` 15分TTLで実装し、Google Calendar と同じパターンを踏襲する。キャッシュキーは `accountType + ":" + startDate + "-" + endDate` の形式を推奨。予約確定時（saga.ts）はキャッシュバイパスしてリアルタイム確認する。ZOOM_B（無料アカウント）がエラー3161（APIスコープ制限）を返した場合は空配列フォールバックで動作継続する。

**Primary recommendation:** 既存 `getCachedBusyTimes` パターンをほぼそのままコピーして `getCachedZoomBusyTimes(accountType, startDate, endDate)` を実装し、slots/route.ts の busyTimes 取得直後にマージする。

---

## Standard Stack

### Core（既存ライブラリの再利用）

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| lru-cache | プロジェクト既存 | Zoomスケジュールの15分TTLキャッシュ | google-calendar.tsで確立済みパターン。新ライブラリ不要 |
| fetch (global) | Node.js 18+ built-in | Zoom API呼び出し | zoom.tsで既使用。外部ライブラリ不要 |

### 新規追加なし

本フェーズはすべて既存ライブラリで実装可能。`npm install` は不要。

---

## Architecture Patterns

### Recommended File Changes

```
src/lib/integrations/zoom.ts        # getZoomScheduledMeetings() + getCachedZoomBusyTimes() 追加
src/app/api/public/slots/route.ts   # ZoomビジーTimesをbusyTimesに追加マージ
src/app/api/public/slots/week/route.ts  # 同上
src/lib/bookings/saga.ts            # Step 2.5: Zoomリアルタイム確認ステップ追加
src/__tests__/lib/integrations/zoom.test.ts  # getZoomScheduledMeetings テスト追加
```

### Pattern 1: getZoomScheduledMeetings() 実装

**What:** Zoom API `/users/me/meetings?type=scheduled` を呼び出し、スケジュール済みミーティングを `BusyTime[]` で返す

**Zoom APIレスポンス型（MEDIUM信頼度 - フォーラム・公式ドキュメント確認済み）:**
```typescript
// Source: Zoom API フォーラム + 公式ドキュメントパターン
interface ZoomMeeting {
  id: number
  uuid: string
  topic: string
  type: number          // 2 = scheduled meeting
  start_time: string    // ISO 8601: "2026-03-28T10:00:00Z"
  duration: number      // 分単位の整数: 30, 60, 90 等
  timezone: string      // "Asia/Tokyo"
  status: string
}

interface ZoomMeetingsResponse {
  page_count: number
  page_size: number
  total_records: number
  next_page_token: string  // ページネーション用。空文字ならページ終了
  meetings: ZoomMeeting[]
}
```

**BusyTime変換の実装:**
```typescript
// Source: CONTEXT.md specifics + フォーラム確認パターン
function convertMeetingsToBusyTimes(meetings: ZoomMeeting[]): BusyTime[] {
  return meetings.map((meeting) => {
    const start = meeting.start_time  // "2026-03-28T10:00:00Z"
    const endMs = new Date(meeting.start_time).getTime() + meeting.duration * 60 * 1000
    const end = new Date(endMs).toISOString()
    return { start, end }
  })
}
```

**エラー3161処理:**
```typescript
// Source: D-08 (CONTEXT.md locked decision)
// エラーレスポンス例: { code: 3161, message: "Your user account is not allowed meeting hosting and scheduling capabilities." }
if (errorBody?.code === 3161) {
  console.warn(`[Zoom] Account ${accountType} API scope limitation (3161), returning empty array`)
  return []
}
```

**ページネーション判断（Claude裁量）:**

30日間（`from` パラメータから30日）のスケジュール済みミーティング数はこのアプリの性質上（1対1の予約システム）非常に少ない。`page_size=300`（最大値）で1リクエストで十分と判断。ページネーションは実装不要。ただし `next_page_token` が返った場合のログは残す。

```typescript
// page_size=300 で十分。next_page_tokenが返った場合は警告ログのみ
if (data.next_page_token) {
  console.warn(`[Zoom] More meetings exist (next_page_token present), using first page only`)
}
```

**getZoomScheduledMeetings() の完全実装パターン:**

```typescript
// Source: 既存zoom.ts + D-01, D-08 パターン
export async function getZoomScheduledMeetings(
  accountType: AccountType,
  fromDate: string,   // ISO 8601: "2026-03-28T00:00:00Z"
  toDate: string      // ISO 8601: "2026-04-04T23:59:59Z"
): Promise<BusyTime[]> {
  if (!isZoomConfigured(accountType)) {
    console.warn(`[Zoom] Account ${accountType} not configured, returning empty schedule`)
    return []
  }

  try {
    const accessToken = await getZoomAccessToken(accountType)
    const params = new URLSearchParams({
      type: "scheduled",
      from: fromDate.split("T")[0],  // YYYY-MM-DD形式
      to: toDate.split("T")[0],
      page_size: "300",
    })

    const response = await fetch(
      `https://api.zoom.us/v2/users/me/meetings?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null)

      // エラー3161: APIスコープ制限（ZOOM_B 無料アカウント等）
      if (errorBody?.code === 3161) {
        console.warn(`[Zoom] Account ${accountType} API scope limitation (3161), returning empty array`)
        return []
      }

      console.warn(`[Zoom] Failed to get meetings for account ${accountType}: ${response.status}`)
      return []
    }

    const data: ZoomMeetingsResponse = await response.json()

    if (data.next_page_token) {
      console.warn(`[Zoom] Account ${accountType}: more meetings exist, using first page only`)
    }

    return convertMeetingsToBusyTimes(data.meetings || [])
  } catch (error) {
    console.error(`[Zoom] Error getting scheduled meetings for account ${accountType}:`, error)
    return []
  }
}
```

### Pattern 2: getCachedZoomBusyTimes() 実装（15分TTLキャッシュ）

**What:** Google Calendar の `getCachedBusyTimes` と同パターンで Zoom スケジュールを 15 分キャッシュする

```typescript
// Source: google-calendar.ts getCachedBusyTimes パターンの踏襲 (D-06)
// zoom.ts に追加する

import { BusyTime } from "./google-calendar"

// LRU Cache for Zoom schedules: 15分TTL
// キャッシュキー: "A:2026-03-28-2026-04-04" 形式
const zoomScheduleCache = new LRUCache<string, BusyTime[]>({
  max: 20,  // accountType(2) × 日付パターン(10) 程度
  ttl: 15 * 60 * 1000, // 15分
})

export async function getCachedZoomBusyTimes(
  accountType: AccountType,
  startDate: string,
  endDate: string
): Promise<BusyTime[]> {
  const cacheKey = `${accountType}:${startDate}-${endDate}`
  const cached = zoomScheduleCache.get(cacheKey)

  if (cached) {
    console.log(`[Zoom] Using cached schedule for account ${accountType}`)
    return cached
  }

  const busyTimes = await getZoomScheduledMeetings(accountType, startDate, endDate)
  zoomScheduleCache.set(cacheKey, busyTimes)

  return busyTimes
}

// キャッシュクリア（テスト用）
export function clearZoomScheduleCache(): void {
  zoomScheduleCache.clear()
  console.log("[Zoom] Schedule cache cleared")
}
```

### Pattern 3: slots/route.ts への統合（busyTimesマージ）

**What:** 既存 Google Calendar busyTimes 取得ブロック（L177-190）の直後に、A・B の Zoom ビジー時間をマージする

**統合箇所の特定（L177-190以降）:**
```typescript
// Source: slots/route.ts L177-190 の既存パターン + D-03, D-04

// 既存コード（変更なし）
let busyTimes: BusyTime[] = []
try {
  busyTimes = await getCachedBusyTimes(busyTimeStart, busyTimeEnd)
  console.log(`[GET /api/public/slots] Got ${busyTimes.length} busy times from calendar`)
} catch (error) {
  console.warn("[GET /api/public/slots] Failed to get busy times, continuing without calendar check:", error)
}

// 新規追加: Zoomビジー時間の取得とマージ（Promise.allSettled 並列）
const [zoomAResult, zoomBResult] = await Promise.allSettled([
  getCachedZoomBusyTimes("A", busyTimeStart, busyTimeEnd),
  getCachedZoomBusyTimes("B", busyTimeStart, busyTimeEnd),
])

if (zoomAResult.status === "fulfilled") {
  busyTimes = [...busyTimes, ...zoomAResult.value]
}
if (zoomBResult.status === "fulfilled") {
  busyTimes = [...busyTimes, ...zoomBResult.value]
}

console.log(`[GET /api/public/slots] Total busy times after Zoom merge: ${busyTimes.length}`)
```

**busyTimesマージの実装方法（Claude裁量）:**

`concat + 重複除去` vs `そのまま追加` の比較:
- `isSlotBusy()` は `busyTimes.some()` で動作するため、重複があっても結果は変わらない
- 重複除去のオーバーヘッドは不要
- **推奨: そのまま配列 spread でマージ** (`[...busyTimes, ...zoomBusyTimes]`)

### Pattern 4: saga.ts へのリアルタイム確認ステップ追加（D-05, D-07）

**挿入位置の特定:**

現在の Saga ステップ:
1. Step 1: validateMenu
2. Step 2: checkSlotAvailability（DB予約重複確認）
3. Step 3: consumePoints
4. Step 4: createBookingRecord
5. Step 5: createZoomMeeting ← ここの直前にZoomスケジュール確認を追加

**Step 2.5 として追加（Step 2 と Step 3 の間が最適）:**

```typescript
// Source: D-05 (CONTEXT.md locked decision) + saga.ts パターン

// Step 2: Check slot availability (using DB EXCLUDE constraint as backup)
// ... 既存コード ...
completedSteps.push("check_slot")

// Step 2.5: Check Zoom schedule conflicts (real-time, cache bypass) — D-05, D-07
console.log("[Saga] Step 2.5: Checking Zoom schedule conflicts")
const zoomConflict = await checkZoomConflict(context.startTime, context.endTime)
if (zoomConflict) {
  return {
    success: false,
    error: "この時間帯はZoomの予定と重複しています",
    errorCode: BookingErrorCodes.SLOT_UNAVAILABLE,
  }
}
// 注意: このステップは補償不要（外部状態を変更しない）
```

**checkZoomConflict ヘルパー関数:**

```typescript
// Source: D-07: キャッシュバイパス（getZoomScheduledMeetings を直接呼び出す）
async function checkZoomConflict(
  startTime: string,
  endTime: string
): Promise<boolean> {
  const [zoomAResult, zoomBResult] = await Promise.allSettled([
    getZoomScheduledMeetings("A", startTime, endTime),
    getZoomScheduledMeetings("B", startTime, endTime),
  ])

  const allBusyTimes: BusyTime[] = []
  if (zoomAResult.status === "fulfilled") allBusyTimes.push(...zoomAResult.value)
  if (zoomBResult.status === "fulfilled") allBusyTimes.push(...zoomBResult.value)

  const start = new Date(startTime)
  const end = new Date(endTime)

  // isSlotBusy と同じ判定ロジック（バッファなし）
  return allBusyTimes.some((busy) => {
    const busyStart = new Date(busy.start).getTime()
    const busyEnd = new Date(busy.end).getTime()
    return start.getTime() < busyEnd && end.getTime() > busyStart
  })
}
```

**補償トランザクションとの整合性:**

Step 2.5 は外部状態を変更しない（読み取りのみ）。`completedSteps` に追加不要。補償ロジック不要。

### Anti-Patterns to Avoid

- **重複除去の過剰実装:** `isSlotBusy()` は `some()` で動作するので、busyTimes の重複は機能に影響しない。Set による重複除去は YAGNI。
- **ページネーションループの実装:** 30日間の個人予定数は少ない（page_size=300 で十分）。ループは過剰実装。
- **エラー3161 で例外スロー:** フォールバック（空配列返却）が正解。スローすると予約フロー全体が止まる。
- **saga.ts への BusyTime import:** `BusyTime` は `google-calendar.ts` でエクスポートされているが、saga.ts からは zoom.ts の `getZoomScheduledMeetings` を直接使うため、型定義は zoom.ts 内で完結させる。

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| スケジュールキャッシュ | カスタムキャッシュ実装 | 既存 LRUCache（zoom.tsでも既使用） | TTL、max、スレッドセーフ等を考慮済み |
| 重複時間判定 | 独自のisOverlap関数 | 既存 isSlotBusy() にマージ | 既にバッファ込みの判定ロジックが確立済み |
| 並列API呼び出し | Promise.all（失敗時に全停止） | Promise.allSettled（D-02で確定） | 片方の失敗がもう片方をブロックしない |

---

## Common Pitfalls

### Pitfall 1: Zoom API `from`/`to` パラメータの形式

**What goes wrong:** `from` に ISO 8601 フルタイムスタンプを渡すと拒否される可能性がある。
**Why it happens:** Zoom API の `from`/`to` は `YYYY-MM-DD` 形式を期待する（時刻部分不要）。
**How to avoid:** `fromDate.split("T")[0]` で日付部分のみ切り出して渡す。
**Warning signs:** API が 400 を返す。

### Pitfall 2: BusyTime の `start`/`end` のタイムゾーン不一致

**What goes wrong:** Zoom APIは `start_time` を UTC で返す（例: `"2026-03-28T01:00:00Z"`）。既存の Google Calendar busyTimes も ISO 8601 UTC。`isSlotBusy()` は `new Date()` で比較するため、タイムゾーンは問題にならない。
**Why it happens:** 混乱の原因は `+09:00` 付きの slotStartISO との比較。`isSlotBusy()` は getTime() 比較なので安全。
**How to avoid:** 変換時に `new Date(meeting.start_time).toISOString()` を使えばUTC統一。
**Warning signs:** ユーザーが空いているはずの時間帯がブロックされると報告する。

### Pitfall 3: saga.ts の Step 2.5 を `completedSteps` に追加してしまう

**What goes wrong:** `checkZoomConflict` は読み取りのみなのに `completedSteps.push("check_zoom")` してしまい、`compensateAll` で存在しないケースを処理しようとする。
**Why it happens:** 他ステップのコピペミス。
**How to avoid:** Step 2（`check_slot`）も `completedSteps` に追加しているが、compensation は不要として switch 文に `check_slot` ケースがない。同じ扱いにする。

### Pitfall 4: ZOOM_B エラー3161 でキャッシュに空配列が保存される

**What goes wrong:** エラー3161 で空配列を返却した場合、その空配列が15分キャッシュに保存される。これは意図通りの動作（D-08）。ただし混乱を招く可能性がある。
**Why it happens:** キャッシュ実装が `getZoomScheduledMeetings` の戻り値をそのまま保存するため。
**How to avoid:** ログで明示する（`console.warn` で「3161のためキャッシュに空配列を保存」）。これは仕様通り。

### Pitfall 5: week/route.ts の busyTimes は週間範囲で一括取得

**What goes wrong:** week/route.ts では 7 日間の `busyTimeStart`〜`busyTimeEnd` で一括取得している。Zoom 側も同様に週間範囲で一括取得する。日付ごとにループ内で取得すると API 呼び出しが 7 倍になる。
**Why it happens:** week/route.ts のループ構造を見ると日付ごとに処理しているが、busyTimes 取得はループの外（L155-164）。
**How to avoid:** Zoom の `getCachedZoomBusyTimes` 呼び出しもループの外で行い、マージした busyTimes をループ内で使う。

---

## Code Examples

### Zoom APIレスポンス型の完全な型定義

```typescript
// Source: Zoom Developer Forum + 公式API仕様パターン (MEDIUM信頼度)
// zoom.ts に追加

interface ZoomScheduledMeeting {
  id: number
  uuid: string
  topic: string
  type: number        // 2: scheduled meeting
  start_time: string  // ISO 8601 UTC: "2026-03-28T01:00:00Z"
  duration: number    // 分単位の整数
  timezone: string    // "Asia/Tokyo"
  status: string      // "waiting" | "started" など
}

interface ZoomListMeetingsResponse {
  page_count: number
  page_size: number
  total_records: number
  next_page_token: string  // 空文字 "" ならページ終了
  meetings: ZoomScheduledMeeting[]
}
```

### テスト追加パターン（zoom.test.ts の既存パターン踏襲）

```typescript
// Source: zoom.test.ts の既存パターン踏襲
// vi.stubEnv + mockFetch パターン

describe("getZoomScheduledMeetings", () => {
  it("should return empty array when account not configured", async () => {
    vi.stubEnv("ZOOM_ACCOUNT_A_ACCOUNT_ID", "")
    const result = await getZoomScheduledMeetings("A", "2026-03-28T00:00:00Z", "2026-04-04T23:59:59Z")
    expect(result).toEqual([])
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("should return empty array on error 3161", async () => {
    vi.stubEnv("ZOOM_ACCOUNT_A_ACCOUNT_ID", "account-id")
    vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_ID", "client-id")
    vi.stubEnv("ZOOM_ACCOUNT_A_CLIENT_SECRET", "client-secret")

    mockFetch
      .mockResolvedValueOnce({  // token fetch
        ok: true,
        json: () => Promise.resolve({ access_token: "token", token_type: "bearer", expires_in: 3600 }),
      })
      .mockResolvedValueOnce({  // meetings fetch → 3161
        ok: false,
        status: 400,
        json: () => Promise.resolve({ code: 3161, message: "..." }),
      })

    const result = await getZoomScheduledMeetings("A", "2026-03-28T00:00:00Z", "2026-04-04T23:59:59Z")
    expect(result).toEqual([])
  })

  it("should convert meetings to BusyTime array", async () => {
    // ... meetings → BusyTime 変換の検証
    // start_time + duration(分) → { start, end } の計算確認
  })
})
```

---

## Runtime State Inventory

本フェーズはコード変更のみ。新規テーブル・マイグレーション不要。Zoom ミーティングデータは Zoom 側に保存されており、ローカルDBには書き込まない。

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | なし — Zoom スケジュールはZoom側に保存、本システムにはキャッシュのみ（メモリ内） | なし |
| Live service config | Zoom Developer Console: OAuthスコープ `meeting:read:list_meetings:admin` の設定確認が必要（LOW信頼度） | デプロイ前に確認 |
| OS-registered state | なし | なし |
| Secrets/env vars | `ZOOM_ACCOUNT_A_*`、`ZOOM_ACCOUNT_B_*` — 既存環境変数をそのまま使用 | なし（新規env var不要） |
| Build artifacts | なし | なし |

---

## Environment Availability

Step 2.6: 外部依存はすべて既存（Zoom S2S OAuth API、既存 env vars）。新規インストールなし。

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Zoom API（外部） | ZOOM-01/02 | 実機確認未（実装時にフォールバックあり） | v2 | 空配列返却で動作継続 |
| lru-cache | ZOOM-03 | ✓ プロジェクト既存 | プロジェクト既存 | — |
| ZOOM_ACCOUNT_A_* env vars | ZOOM-01 | ✓ 既存設定済み | — | isZoomConfigured()でスキップ |
| ZOOM_ACCOUNT_B_* env vars | ZOOM-02 | ✓ 既存設定済み | — | isZoomConfigured()でスキップ |

**Missing dependencies with fallback:**
- ZOOM_B の `meeting:read:list_meetings:admin` スコープ: エラー3161フォールバック実装済みで動作継続

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest（プロジェクト既存） |
| Config file | `vitest.config.ts`（既存） |
| Quick run command | `npx vitest run src/__tests__/lib/integrations/zoom.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ZOOM-01 | getZoomScheduledMeetings("A") が BusyTime[] を返す | unit | `npx vitest run src/__tests__/lib/integrations/zoom.test.ts` | ✅（既存ファイルに追加） |
| ZOOM-02 | エラー3161で空配列返却（ZOOM_B フォールバック） | unit | `npx vitest run src/__tests__/lib/integrations/zoom.test.ts` | ✅（既存ファイルに追加） |
| ZOOM-03 | getCachedZoomBusyTimes が2回目呼び出しでキャッシュを使用 | unit | `npx vitest run src/__tests__/lib/integrations/zoom.test.ts` | ✅（既存ファイルに追加） |
| ZOOM-04 | saga.ts の Step 2.5 がキャッシュバイパスしてリアルタイム確認する | unit | `npx vitest run src/__tests__/lib/bookings/saga.test.ts` | ❌ Wave 0 or 既存sagaテストに追加 |

### Wave 0 Gaps

- `src/__tests__/lib/integrations/zoom.test.ts` — ZOOM-01/02/03 の新テストを既存ファイルに追加（ファイル自体は既存）
- ZOOM-04 のsaga.tsテストは既存ファイルがあるか要確認

---

## Open Questions

1. **ZOOM_B の OAuthスコープ名**
   - What we know: `meeting:read:list_meetings:admin` がフォーラムで言及されている（信頼度MEDIUM）
   - What's unclear: 無料アカウント（ZOOM_B）でこのスコープが適用可能かどうか
   - Recommendation: D-08 通りエラー3161フォールバックを実装し、デプロイ後に実機確認（D-09）

2. **Zoom API `from`/`to` パラメータで「今日の予定のみ」 vs「週間全体」の範囲**
   - What we know: `slots/route.ts` は1日分、`week/route.ts` は7日分の busyTimes を取得する
   - What's unclear: slots/route.ts に渡す日付範囲をそのまま Zoom の `from`/`to` に使えるか（`YYYY-MM-DD` 形式への変換が必要）
   - Recommendation: `busyTimeStart` から `split("T")[0]` で日付部分を抽出して使用

3. **saga.ts のチェック対象日時範囲**
   - What we know: `context.startTime` と `context.endTime` が予約時間（例: `"2026-04-01T10:00:00+09:00"`）
   - What's unclear: Zoom API の `from`/`to` は日付単位のため、その日全体を指定する必要があるか
   - Recommendation: saga では `from = startTime の日付`、`to = endTime の日付` で取得し、`checkZoomConflict` 内で時間重複判定する

---

## Sources

### Primary (HIGH confidence)
- `src/lib/integrations/zoom.ts` — 既存Zoom統合の確認（getZoomAccessToken、LRUCacheパターン）
- `src/lib/integrations/google-calendar.ts` — getCachedBusyTimes パターンの確認（15分TTL、キャッシュキー設計）
- `src/lib/bookings/saga.ts` — Sagaステップ構造の確認（Step 2/5の間に挿入位置特定）
- `src/app/api/public/slots/route.ts` — busyTimesマージポイント（L177-190）の確認
- `src/app/api/public/slots/week/route.ts` — 週間版の同等実装確認

### Secondary (MEDIUM confidence)
- [Zoom Developer Forum: Error 3161 on GET /users/{userId}/meetings](https://devforum.zoom.us/t/api-error-code-3161-on-get-users-userid-meetings-v2-zoom-endpoint/136447) — エラー3161の内容（"Meeting hosting and scheduling capabilities are not allowed"）+ 必要スコープ（`meeting:read:list_meetings:admin`）
- [Zoom API公式ドキュメント](https://developers.zoom.us/docs/api/meetings/) — ページネーション（next_page_token, page_size最大300）、レスポンスフィールド（start_time ISO 8601、duration 分単位）

### Tertiary (LOW confidence)
- Zoom API フォーラム: `from`/`to` パラメータ形式（YYYY-MM-DD） — 単一ソース、未実機確認
- ZOOM_B 無料アカウントでのエラー3161発生有無 — フォーラムで報告例あり、ただし一致しないケースも（D-09でデプロイ後確認）

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 既存コードのみ、新規ライブラリなし
- Architecture（BusyTimeマージ、LRUCacheパターン）: HIGH — 既存パターンの踏襲
- Zoom API レスポンス型: MEDIUM — フォーラム確認済み、実機未確認
- エラー3161の無料アカウント挙動: LOW — フォーラムのみ、実機未確認（D-09でデプロイ後確認）
- Saga統合（Step 2.5の位置）: HIGH — saga.tsのソースコード直接確認

**Research date:** 2026-03-28
**Valid until:** 2026-04-28（Zoom APIは安定しているため30日）
