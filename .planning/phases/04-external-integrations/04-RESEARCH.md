# Phase 4: 外部API統合 - Research

**Researched:** 2026-02-22
**Domain:** External API integration (Google Calendar, Zoom, Resend), OAuth 2.0, compensating transactions
**Confidence:** MEDIUM-HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SYS-02 | システムは予約確定時にZoom会議を自動生成する（メニューに応じてアカウントA/B使い分け） | Zoom Server-to-Server OAuth、複数アカウント管理パターン、meeting:write:admin scope |
| SYS-03 | システムはキャンセル時にZoom会議を削除する | Zoom Delete Meeting API、Sagaパターン補償トランザクション |
| SYS-04 | システムは予約確認メールを送信する（ユーザー+管理者宛） | Resend API、React Email templates、並列送信パターン |
| SYS-06 | システムはキャンセル時にキャンセルメールを送信する | Resend API、トランザクショナルメール、エラーハンドリング |
| SYS-07 | システムは予約時に管理者カレンダーにイベント追加、キャンセル時に削除する | Google Calendar API Events.insert/delete、OAuth refresh token管理 |
| ADMIN-02 | 管理者はGoogleカレンダーと同期して空き時間を自動反映できる | Google Calendar API Events.list、FreeBusy query、15分キャッシュ戦略 |
</phase_requirements>

## Summary

Phase 4では、Google Calendar、Zoom、Resendの3つの外部APIを統合し、予約システムの自動化を実現します。Phase 2で構築したSagaオーケストレーターのモック実装を本物のAPI呼び出しに置き換え、OAuth認証フロー、トークン管理、レート制限、補償トランザクションを実装します。

主な技術的課題は以下の通りです。
1. **OAuth 2.0トークン管理**: Google CalendarのOAuth refresh tokenは初回認証時のみ取得可能。`access_type: 'offline'`の設定とAES-256暗号化によるデータベース保存が必須。
2. **レート制限対応**: Google Calendar APIは10 QPSの制限があり、指数バックオフ戦略が必要。
3. **Zoom複数アカウント管理**: メニューに応じて異なるZoomアカウントを使用するため、Server-to-Server OAuth appを2つ作成し、環境変数で管理。
4. **補償トランザクション拡張**: Phase 2のSagaパターンを拡張し、外部API失敗時のロールバック（Zoom会議削除、カレンダーイベント削除）を実装。

**Primary recommendation:** GoogleのOAuth refresh tokenを初回セットアップ時に取得・保存し、`googleapis`ライブラリの自動リフレッシュ機能を活用。Zoomは1時間ごとのトークン再取得、Resendはシンプルなヘッダー認証で対応。すべての外部API呼び出しにタイムアウトとエラーハンドリングを設定し、Sagaパターンで一貫性を担保。

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| googleapis | Latest (155+) | Google Calendar API client | 公式Node.jsクライアント、TypeScriptネイティブ、自動トークンリフレッシュ機能内蔵 |
| google-auth-library | Latest (9+) | OAuth 2.0認証 | googleapisに含まれる、refresh token自動管理、'tokens'イベントでトークン更新検出 |
| resend | Latest (4+) | トランザクショナルメール送信 | Next.js最適化、React Email統合、TypeScriptネイティブ、開発者体験が優れている |
| @zoom/node-sdk | なし（直接API呼び出し） | Zoom Meeting API | 公式SDKは存在するが、Server-to-Server OAuthには不要。直接REST API呼び出しが推奨 |
| react-email | Latest (3+) | メールテンプレート作成 | JSX/TSXでメールを記述可能、プレビュー機能、Resendとの統合が公式サポート |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jose | Latest (5+) | JWT検証（既存実装） | Phase 3で導入済み。キャンセルトークン検証に使用 |
| nanoid | Latest (5+) | 冪等性キー生成（既存実装） | Phase 2で導入済み。Idempotency-Key生成に使用 |
| validator | Latest (13+) | 入力バリデーション（既存実装） | Phase 3で導入済み。メールアドレス検証に使用 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| googleapis | gcal (lightweight wrapper) | googleapis公式が安全。gcalは薄いラッパーだが自動リフレッシュ機能が不透明 |
| Resend | Nodemailer | Resendの方がトランザクショナルメール特化、到達率が高い、React Emailサポート |
| 直接API呼び出し（Zoom） | @zoom/node-sdk | SDKはOAuth User-Managed向け。Server-to-Server OAuthは直接APIが軽量 |

**Installation:**
```bash
npm install googleapis resend react-email
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── integrations/          # 外部API統合
│   │   ├── google-calendar.ts # Google Calendar API client
│   │   ├── zoom.ts            # Zoom API client
│   │   ├── email.ts           # Resend client (React Email使用)
│   │   └── oauth/             # OAuth認証管理
│   │       ├── google.ts      # Google OAuth client
│   │       └── tokens.ts      # トークン暗号化・保存
│   ├── bookings/
│   │   └── saga.ts            # 既存Sagaを拡張（モック→本実装）
│   └── utils/
│       ├── rate-limit.ts      # レート制限（LRUキャッシュ、既存）
│       └── retry.ts           # 指数バックオフリトライ
├── emails/                     # React Emailテンプレート
│   ├── BookingConfirmation.tsx
│   ├── BookingCancellation.tsx
│   └── components/            # 共通コンポーネント
│       └── Layout.tsx
supabase/
└── migrations/
    └── 20260222_oauth_tokens.sql # OAuth token保存テーブル
```

### Pattern 1: OAuth Refresh Token管理
**What:** Google OAuth 2.0のrefresh tokenを初回認証時に取得し、データベースに暗号化保存。`googleapis`ライブラリの'tokens'イベントでトークン更新を検知し、自動でDB更新。

**When to use:** Google Calendar APIを使用する全ての操作（イベント追加/削除/一覧取得）

**Example:**
```typescript
// Source: https://github.com/googleapis/google-api-nodejs-client
import { google } from 'googleapis';
import { getOAuthClient, saveTokens } from '@/lib/integrations/oauth/google';

// OAuth client初期化（DBからrefresh token読み込み）
const oauth2Client = await getOAuthClient();

// 自動リフレッシュとトークン保存
oauth2Client.on('tokens', async (tokens) => {
  if (tokens.refresh_token) {
    // 初回認証時のみrefresh_tokenが含まれる
    await saveTokens({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date
    });
  } else {
    // リフレッシュ時はaccess_tokenのみ更新
    await saveTokens({
      access_token: tokens.access_token,
      expiry_date: tokens.expiry_date
    });
  }
});

// Calendar API使用（自動でトークンリフレッシュされる）
const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
const response = await calendar.events.insert({
  calendarId: 'primary',
  requestBody: {
    summary: 'セッション予約',
    start: { dateTime: '2026-02-23T10:00:00+09:00' },
    end: { dateTime: '2026-02-23T10:30:00+09:00' },
  },
});
```

### Pattern 2: Zoom Server-to-Server OAuth（複数アカウント）
**What:** Zoomは1時間有効期限のaccess tokenのみ。refresh tokenは存在しない。メニューに応じてアカウントA/Bを切り替えるため、2つのServer-to-Server OAuth appを作成し、環境変数で管理。

**When to use:** 予約作成時のZoom会議生成、キャンセル時の会議削除

**Example:**
```typescript
// Source: https://developers.zoom.us/docs/internal-apps/s2s-oauth/
async function getZoomAccessToken(accountType: 'A' | 'B'): Promise<string> {
  const credentials = {
    A: {
      accountId: process.env.ZOOM_ACCOUNT_A_ID,
      clientId: process.env.ZOOM_ACCOUNT_A_CLIENT_ID,
      clientSecret: process.env.ZOOM_ACCOUNT_A_CLIENT_SECRET,
    },
    B: {
      accountId: process.env.ZOOM_ACCOUNT_B_ID,
      clientId: process.env.ZOOM_ACCOUNT_B_CLIENT_ID,
      clientSecret: process.env.ZOOM_ACCOUNT_B_CLIENT_SECRET,
    },
  }[accountType];

  const response = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'account_credentials',
      account_id: credentials.accountId,
    }),
  });

  const data = await response.json();
  return data.access_token; // 1時間有効、キャッシュ推奨
}

async function createZoomMeeting(accountType: 'A' | 'B', params: { topic: string; start_time: string; duration: number }) {
  const accessToken = await getZoomAccessToken(accountType);
  const response = await fetch('https://api.zoom.us/v2/users/me/meetings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  return response.json();
}
```

### Pattern 3: Resend with React Email
**What:** React EmailでTypeScript/JSXベースのメールテンプレートを作成し、Resend APIで送信。テンプレートはコンポーネント化して再利用可能。

**When to use:** 予約確認メール、キャンセルメール送信

**Example:**
```typescript
// Source: https://resend.com/docs/send-with-nextjs
// emails/BookingConfirmation.tsx
import { Html, Head, Body, Container, Heading, Text, Link } from '@react-email/components';

interface BookingConfirmationProps {
  userName: string;
  sessionTitle: string;
  startTime: string;
  zoomUrl: string;
  cancelToken: string;
}

export function BookingConfirmation({ userName, sessionTitle, startTime, zoomUrl, cancelToken }: BookingConfirmationProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif' }}>
        <Container>
          <Heading>{userName}さん、予約が完了しました</Heading>
          <Text>セッション: {sessionTitle}</Text>
          <Text>日時: {startTime}</Text>
          <Link href={zoomUrl}>Zoomミーティングに参加</Link>
          <Link href={`https://example.com/cancel/${cancelToken}`}>キャンセルする</Link>
        </Container>
      </Body>
    </Html>
  );
}

// lib/integrations/email.ts
import { Resend } from 'resend';
import { BookingConfirmation } from '@/emails/BookingConfirmation';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendBookingConfirmationEmail(params: {
  to: string;
  userName: string;
  sessionTitle: string;
  startTime: string;
  zoomUrl: string;
  cancelToken: string;
}) {
  const { data, error } = await resend.emails.send({
    from: 'Time with Kazumin <booking@example.com>',
    to: [params.to],
    subject: `予約完了: ${params.sessionTitle}`,
    react: BookingConfirmation(params),
  });

  if (error) {
    throw new Error(`Email sending failed: ${error.message}`);
  }
  return data;
}
```

### Pattern 4: Google Calendar Rate Limiting with Exponential Backoff
**What:** Google Calendar APIは10 QPSの制限があり、超過時に403/429エラーが返る。指数バックオフで自動リトライし、最大3回まで試行。

**When to use:** すべてのGoogle Calendar API呼び出し

**Example:**
```typescript
// Source: https://developers.google.com/workspace/calendar/api/guides/errors
async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000,
): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error: any) {
      // Rate limit errors: 403 usageLimits or 429
      if ((error.code === 403 || error.code === 429) && attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000; // jitter追加
        console.log(`Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retries exceeded');
}

// 使用例
const event = await retryWithExponentialBackoff(() =>
  calendar.events.insert({
    calendarId: 'primary',
    requestBody: eventData,
  })
);
```

### Pattern 5: Saga補償トランザクション拡張
**What:** Phase 2で実装したSagaオーケストレーターを拡張し、外部API失敗時の補償処理を追加。Zoom会議作成失敗時はポイント返還、カレンダー追加後にメール送信失敗してもロールバックしない（メールは非クリティカル）。

**When to use:** 予約作成・キャンセルの全フロー

**Example:**
```typescript
// lib/bookings/saga.ts拡張
import { createZoomMeeting, deleteZoomMeeting } from '@/lib/integrations/zoom';
import { addCalendarEvent, deleteCalendarEvent } from '@/lib/integrations/google-calendar';
import { sendBookingConfirmationEmail } from '@/lib/integrations/email';

export async function createBookingSaga(request: BookingRequest, supabase: SupabaseClient) {
  const executedSteps: Array<{ name: string; data?: any }> = [];

  try {
    // Step 1-4: 既存実装（冪等性、空き確認、ポイント消費、予約レコード作成）
    // ...

    // Step 5: Zoom会議作成（本実装に置換）
    const menu = await getMenu(request.menu_id);
    const zoomAccountType = menu.zoom_account; // 'A' or 'B'
    const zoomMeeting = await createZoomMeeting(zoomAccountType, {
      topic: `${menu.name} - ${request.userName}`,
      start_time: request.start_time,
      duration: menu.duration_minutes,
    });
    executedSteps.push({ name: 'zoom_meeting', data: { meeting_id: zoomMeeting.id } });

    // Step 6: Google Calendar追加
    const calendarEvent = await retryWithExponentialBackoff(() =>
      addCalendarEvent({
        summary: `セッション: ${menu.name}`,
        start: request.start_time,
        end: request.end_time,
      })
    );
    executedSteps.push({ name: 'calendar_event', data: { event_id: calendarEvent.id } });

    // Step 7: 予約確定（zoom_meeting_id, google_event_idを保存）
    await supabase
      .from('bookings')
      .update({
        status: 'confirmed',
        zoom_meeting_id: zoomMeeting.id,
        zoom_join_url: zoomMeeting.join_url,
        google_event_id: calendarEvent.id,
      })
      .eq('id', bookingId);

    // Step 8: メール送信（ユーザー+管理者、並列実行、失敗しても継続）
    await Promise.allSettled([
      sendBookingConfirmationEmail({
        to: request.userEmail,
        userName: request.userName,
        sessionTitle: menu.name,
        startTime: request.start_time,
        zoomUrl: zoomMeeting.join_url,
        cancelToken: await generateCancelToken(bookingId),
      }),
      sendBookingConfirmationEmail({
        to: process.env.ADMIN_EMAIL,
        userName: 'Admin',
        sessionTitle: `新規予約: ${menu.name}`,
        startTime: request.start_time,
        zoomUrl: zoomMeeting.start_url, // host用URL
        cancelToken: '',
      }),
    ]);

    return { success: true, booking_id: bookingId, zoom_join_url: zoomMeeting.join_url };
  } catch (error) {
    // 補償トランザクション（逆順実行）
    console.error('Saga failed, executing compensation', error);
    for (let i = executedSteps.length - 1; i >= 0; i--) {
      const step = executedSteps[i];
      try {
        if (step.name === 'zoom_meeting') {
          await deleteZoomMeeting(step.data.meeting_id);
        } else if (step.name === 'calendar_event') {
          await retryWithExponentialBackoff(() => deleteCalendarEvent(step.data.event_id));
        } else if (step.name === 'booking_record') {
          await supabase.from('bookings').delete().eq('id', step.data.booking_id);
        } else if (step.name === 'points_consumed') {
          await supabase.rpc('refund_points', { p_member_plan_id: request.member_plan_id, p_points: menu.cost_points });
        }
      } catch (compensationError) {
        console.error(`Compensation failed for step ${step.name}`, compensationError);
        // 補償失敗はログに記録（管理者が手動で修正）
      }
    }
    throw error;
  }
}
```

### Anti-Patterns to Avoid
- **手動トークンリフレッシュ**: `googleapis`の自動リフレッシュ機能を使わず、手動でexpiry_dateをチェックしてrefresh。ライブラリが自動で処理するため不要。
- **Zoomトークンの永続化**: Server-to-Server OAuthトークンは1時間有効で、refresh tokenが存在しない。DBに保存しても期限切れになるため、メモリキャッシュ（LRU、TTL 3500秒）で管理。
- **同期的な外部API呼び出し**: Zoom/Calendar/Emailを直列実行すると遅い。Zoomとカレンダーは依存関係があるが、メール送信は並列実行可能。
- **Batch APIの過度な使用**: Google Calendar Batch APIは1000リクエストまで可能だが、単一イベント追加/削除では不要。複数イベント操作時のみ使用。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth 2.0トークンリフレッシュ | 独自のトークン期限管理とリフレッシュロジック | `googleapis`の自動リフレッシュ + 'tokens'イベント | トークンのライフサイクル管理は複雑（期限切れ、リフレッシュ失敗、トークン無効化）。公式ライブラリが安全に処理 |
| メールHTML生成 | 文字列連結やテンプレートリテラルでHTMLメール作成 | React Email + Resend | メールクライアント間の互換性が複雑（Outlook, Gmail, Apple Mail）。React Emailがテスト済みコンポーネントを提供 |
| レート制限管理 | グローバルカウンターでAPI呼び出し回数をカウント | 指数バックオフ + Google Calendar API quotaUser | レート制限はユーザーごと・プロジェクトごとに分かれており、エラー後のリトライが最適。バックオフはGoogleが推奨 |
| 外部APIロールバック | try-catchで個別にエラーハンドリング | Sagaオーケストレーターパターン | 複数API呼び出しの一貫性を保つため、ステップ記録と補償トランザクションが必要 |
| トークン暗号化 | Base64エンコードやシンプルなXOR暗号化 | AES-256 + KMS（または環境変数ENCRYPTION_KEY） | OAuth tokenは機密情報。AES-256は業界標準で、PostgreSQLのpgcrypto拡張と連携可能 |

**Key insight:** 外部API統合は「動けばいい」ではなく、「失敗時の回復」「セキュリティ」「レート制限遵守」が重要。公式ライブラリと確立されたパターン（Saga、exponential backoff）を使用することで、エッジケースを回避。

## Common Pitfalls

### Pitfall 1: Google OAuth Refresh Token取得漏れ
**What goes wrong:** 初回認証時に`access_type: 'offline'`を設定し忘れ、refresh tokenが取得できない。後から取得しようとしても、再認証が必要で、ユーザーは既に承認済みのため`refresh_token`が返らない。

**Why it happens:** GoogleのOAuthドキュメントで`access_type`がオプション扱いになっており、デフォルトは`online`。refresh tokenは「初回認証かつofflineモード」でのみ返される。

**How to avoid:**
- OAuth URL生成時に必ず`access_type: 'offline', prompt: 'consent'`を設定
- 取得したrefresh tokenをAES-256で暗号化してDBに保存
- セットアップ手順書で管理者に「再認証が必要な場合はGoogle側で既存の承認を削除」と明記

**Warning signs:**
- `oauth2Client.credentials.refresh_token`が`undefined`
- API呼び出し時に「The OAuth client was not able to retrieve an access token」エラー

### Pitfall 2: Google Calendar Rate Limit超過
**What goes wrong:** 複数ユーザーが同時に予約を作成すると、Google Calendar APIが10 QPS制限に達し、403/429エラーが返る。リトライしないと予約が失敗。

**Why it happens:** Supabaseアプリケーション全体で1つのGoogleアカウントを使用しており、すべてのAPI呼び出しが同一プロジェクトにカウントされる。10 QPSは思ったより低い（同時10予約で上限）。

**How to avoid:**
- 指数バックオフリトライを全てのCalendar API呼び出しに実装
- `quotaUser`パラメータで実ユーザーをクォータに反映（Service Account + Domain-wide Delegation時）
- 空き時間計算は15分キャッシュ（Phase 4要件、ADMIN-02）を使用し、API呼び出しを削減

**Warning signs:**
- エラーログに「Rate Limit Exceeded」「usageLimits」が頻出
- 予約作成が特定時間帯に失敗する

### Pitfall 3: Zoomアカウント切り替え失敗
**What goes wrong:** メニューテーブルに`zoom_account`カラムを追加し忘れ、全ての予約が同じZoomアカウントで会議を作成してしまう。または、環境変数の設定ミスで「アカウントB」が存在しないエラー。

**Why it happens:** 要件（SYS-02）に「メニューに応じてアカウントA/B使い分け」とあるが、データモデルに反映し忘れる。環境変数が多く（6個: 2アカウント×3項目）、設定漏れが起きやすい。

**How to avoid:**
- Phase 4開始時に`meeting_menus`テーブルに`zoom_account CHAR(1) CHECK (zoom_account IN ('A', 'B'))`カラムを追加
- 環境変数チェック関数を実装し、アプリ起動時にZOOM_ACCOUNT_A/B_*が全て設定されているか検証
- デフォルト値を設定（アカウントAをデフォルト）し、NULL時の挙動を明確化

**Warning signs:**
- Zoom API呼び出し時に401 Unauthorized
- 会議が常に同じホストアカウントで作成される

### Pitfall 4: メール送信失敗で予約全体がロールバック
**What goes wrong:** Sagaパターンでメール送信を必須ステップにしてしまい、Resend APIがダウンすると予約が作成できない。メールは「通知」であり、予約の成立には必須ではない。

**Why it happens:** Sagaの全ステップを同等に扱い、1つでも失敗したら全てロールバックする設計。Phase 2のモック実装では「失敗しても継続」とコメントがあるが、本実装で忘れがち。

**How to avoid:**
- メール送信を`Promise.allSettled()`でラップし、失敗してもSaga全体は成功扱い
- メール送信失敗は別途ログに記録し、管理画面で未送信メールを確認・再送信できる仕組み（Phase 5で検討）
- Resend APIのエラーレスポンスを監視し、継続的な失敗をアラート

**Warning signs:**
- 「メールサーバーエラー」で予約が作成されない
- ユーザーが「予約できない」と報告するが、Zoom/Calendarは正常

### Pitfall 5: OAuth Token暗号化キーの漏洩
**What goes wrong:** 環境変数`ENCRYPTION_KEY`をGitにコミットしてしまい、リポジトリが公開されるとOAuth tokenが復号化される。攻撃者がGoogle Calendarを操作可能になる。

**Why it happens:** `.env.local`をそのまま`.env.example`にコピーし、実際の値が残る。または、ドキュメントに「テスト用に`ENCRYPTION_KEY=test123`を使用」と記載してしまう。

**How to avoid:**
- `.env.example`には`ENCRYPTION_KEY=your-32-byte-random-key-here`のようなプレースホルダーのみ記載
- セットアップスクリプトで`openssl rand -hex 32`を実行し、ランダムキーを生成する手順を提供
- Supabase VaultまたはVercel Environment Variablesで暗号化キーを管理（GUIから設定、コードには含まれない）

**Warning signs:**
- GitHub Secret Scanningアラートが発火
- `.env.local`がコミット履歴に含まれている

### Pitfall 6: Sagaステップの冪等性欠如
**What goes wrong:** Zoom会議作成は成功したが、Calendar追加で失敗し、リトライ時に同じZoom会議を再度作成してしまう。同じ予約に複数のZoom URLが紐づく。

**Why it happens:** Phase 2の冪等性管理（idempotency_keys）は予約全体に適用されているが、各Sagaステップ（Zoom、Calendar）は冪等ではない。ネットワーク障害で部分的に成功した場合、再実行時に重複。

**How to avoid:**
- 予約レコードに`zoom_meeting_id`を保存し、既に存在する場合はZoom作成をスキップ
- Google Calendar APIの`conferenceData.createRequest.requestId`を使用し、同じリクエストIDでの重複作成を防止
- Sagaステップごとに「既に実行済みか」をチェックするガード条件を追加

**Warning signs:**
- 同じ予約に複数のZoom meeting IDが関連付けられる
- キャンセル時に「会議が見つからない」エラーが発生（最初の会議IDは既に削除済み）

## Code Examples

Verified patterns from official sources:

### Google OAuth Client初期化（refresh token付き）
```typescript
// Source: https://github.com/googleapis/google-api-nodejs-client
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// 初回認証URL生成（管理者セットアップ時のみ）
export function getAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // refresh token取得に必須
    prompt: 'consent', // 毎回consent画面を表示（refresh_token再取得時に必要）
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ],
  });
}

// 認証コードからトークン取得（初回のみ）
export async function getTokensFromCode(code: string) {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // tokens.refresh_tokenを暗号化してDBに保存
  if (tokens.refresh_token) {
    await saveEncryptedTokens(tokens);
  }

  return tokens;
}

// DB保存されたトークンでクライアント初期化（通常時）
export async function getOAuthClient() {
  const tokens = await getDecryptedTokens();
  oauth2Client.setCredentials(tokens);

  // 自動リフレッシュ時のトークン更新を監視
  oauth2Client.on('tokens', async (newTokens) => {
    await saveEncryptedTokens({
      ...tokens,
      ...newTokens, // access_tokenとexpiry_dateが更新される
    });
  });

  return oauth2Client;
}
```

### Zoom Server-to-Server OAuth Token取得（キャッシュ付き）
```typescript
// Source: https://developers.zoom.us/docs/internal-apps/s2s-oauth/
import { LRUCache } from 'lru-cache';

const zoomTokenCache = new LRUCache<string, string>({
  max: 2, // アカウントA, Bの2つ
  ttl: 3500 * 1000, // 3500秒（1時間 - 100秒バッファ）
});

export async function getZoomAccessToken(accountType: 'A' | 'B'): Promise<string> {
  const cached = zoomTokenCache.get(accountType);
  if (cached) return cached;

  const config = {
    A: {
      accountId: process.env.ZOOM_ACCOUNT_A_ID!,
      clientId: process.env.ZOOM_ACCOUNT_A_CLIENT_ID!,
      clientSecret: process.env.ZOOM_ACCOUNT_A_CLIENT_SECRET!,
    },
    B: {
      accountId: process.env.ZOOM_ACCOUNT_B_ID!,
      clientId: process.env.ZOOM_ACCOUNT_B_CLIENT_ID!,
      clientSecret: process.env.ZOOM_ACCOUNT_B_CLIENT_SECRET!,
    },
  }[accountType];

  const authHeader = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

  const response = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'account_credentials',
      account_id: config.accountId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Zoom OAuth failed: ${response.statusText}`);
  }

  const data = await response.json();
  zoomTokenCache.set(accountType, data.access_token);
  return data.access_token;
}

export async function createZoomMeeting(
  accountType: 'A' | 'B',
  params: { topic: string; start_time: string; duration: number }
) {
  const accessToken = await getZoomAccessToken(accountType);

  const response = await fetch('https://api.zoom.us/v2/users/me/meetings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topic: params.topic,
      type: 2, // Scheduled meeting
      start_time: params.start_time,
      duration: params.duration,
      timezone: 'Asia/Tokyo',
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Zoom meeting creation failed: ${response.statusText}`);
  }

  return response.json();
}
```

### Resendメール送信（並列、エラーハンドリング）
```typescript
// Source: https://resend.com/docs/send-with-nextjs
import { Resend } from 'resend';
import { BookingConfirmation } from '@/emails/BookingConfirmation';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendBookingEmails(booking: {
  id: string;
  user_email: string;
  user_name: string;
  menu_name: string;
  start_time: string;
  zoom_join_url: string;
}) {
  const cancelToken = await generateCancelToken(booking.id);

  // ユーザーと管理者に並列送信（どちらか失敗しても継続）
  const results = await Promise.allSettled([
    resend.emails.send({
      from: 'Time with Kazumin <booking@yourdomain.com>',
      to: [booking.user_email],
      subject: `予約完了: ${booking.menu_name}`,
      react: BookingConfirmation({
        userName: booking.user_name,
        sessionTitle: booking.menu_name,
        startTime: booking.start_time,
        zoomUrl: booking.zoom_join_url,
        cancelToken,
      }),
    }),
    resend.emails.send({
      from: 'Time with Kazumin <booking@yourdomain.com>',
      to: [process.env.ADMIN_EMAIL!],
      subject: `新規予約: ${booking.menu_name}`,
      react: BookingConfirmation({
        userName: 'Admin',
        sessionTitle: `${booking.user_name}さんの予約`,
        startTime: booking.start_time,
        zoomUrl: booking.zoom_join_url,
        cancelToken: '',
      }),
    }),
  ]);

  // 失敗をログ記録（Sagaは継続）
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`Email ${index === 0 ? 'user' : 'admin'} failed:`, result.reason);
    }
  });

  return results;
}
```

### Google Calendar空き時間チェック（FreeBusy API）
```typescript
// Source: https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query
import { google } from 'googleapis';
import { getOAuthClient } from '@/lib/integrations/oauth/google';

export async function getAdminBusyTimes(startDate: string, endDate: string) {
  const oauth2Client = await getOAuthClient();
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: startDate,
      timeMax: endDate,
      timeZone: 'Asia/Tokyo',
      items: [{ id: 'primary' }],
    },
  });

  const busySlots = response.data.calendars?.primary?.busy || [];
  return busySlots; // [{ start: '2026-02-23T10:00:00+09:00', end: '2026-02-23T11:00:00+09:00' }]
}

// 15分キャッシュ（ADMIN-02要件）
import { LRUCache } from 'lru-cache';

const busyTimesCache = new LRUCache<string, any[]>({
  max: 100,
  ttl: 15 * 60 * 1000, // 15分
});

export async function getCachedBusyTimes(startDate: string, endDate: string) {
  const cacheKey = `${startDate}-${endDate}`;
  const cached = busyTimesCache.get(cacheKey);
  if (cached) return cached;

  const busyTimes = await getAdminBusyTimes(startDate, endDate);
  busyTimesCache.set(cacheKey, busyTimes);
  return busyTimes;
}
```

### AES-256トークン暗号化（PostgreSQL pgcrypto）
```typescript
// Source: https://www.postgresql.org/docs/current/pgcrypto.html
// supabase/migrations/20260222_oauth_tokens.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE oauth_tokens (
  id SERIAL PRIMARY KEY,
  provider TEXT NOT NULL, -- 'google', 'zoom_a', 'zoom_b'
  access_token_encrypted BYTEA NOT NULL,
  refresh_token_encrypted BYTEA,
  expiry_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 暗号化関数（アプリケーションから呼び出し）
CREATE OR REPLACE FUNCTION encrypt_token(token TEXT, encryption_key TEXT)
RETURNS BYTEA AS $$
  SELECT pgp_sym_encrypt(token, encryption_key);
$$ LANGUAGE SQL IMMUTABLE;

CREATE OR REPLACE FUNCTION decrypt_token(encrypted_token BYTEA, encryption_key TEXT)
RETURNS TEXT AS $$
  SELECT pgp_sym_decrypt(encrypted_token, encryption_key);
$$ LANGUAGE SQL IMMUTABLE;

// TypeScript側
export async function saveEncryptedTokens(tokens: { access_token: string; refresh_token?: string; expiry_date?: number }) {
  const encryptionKey = process.env.ENCRYPTION_KEY!;

  await supabase.rpc('upsert_oauth_token', {
    p_provider: 'google',
    p_access_token: tokens.access_token,
    p_refresh_token: tokens.refresh_token || null,
    p_expiry_date: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    p_encryption_key: encryptionKey,
  });
}

export async function getDecryptedTokens() {
  const encryptionKey = process.env.ENCRYPTION_KEY!;

  const { data, error } = await supabase.rpc('get_oauth_token', {
    p_provider: 'google',
    p_encryption_key: encryptionKey,
  });

  if (error || !data) {
    throw new Error('OAuth tokens not found');
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry_date: new Date(data.expiry_date).getTime(),
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JWT Apps（Zoom） | Server-to-Server OAuth Apps | 2023年6月廃止 | JWT Appsは完全廃止。新規作成不可。S2S OAuthへの移行が必須 |
| Nodemailer（SMTP） | Resend（HTTP API） | 2023年以降主流 | SMTP認証エラーが多発。ResendはAPI keyのみで、到達率が高い |
| 手動トークンリフレッシュ | googleapis自動リフレッシュ | 2020年頃から安定 | 'tokens'イベントでトークン更新を検知し、DB保存が標準パターン |
| Google Calendar Sync API | FreeBusy API + キャッシュ | 2024年頃から推奨 | Sync APIは複雑。FreeBusy + 15分キャッシュで十分（Phase 4要件） |

**Deprecated/outdated:**
- **Zoom JWT Apps**: 2023年6月に廃止。既存アプリは2026年まで動作するが、新規作成不可。Server-to-Server OAuthへ移行必須。
- **googleapis v100以前**: TypeScript型定義が不完全。v105以降を推奨（2024年時点）。
- **google-auth-library単体使用**: `googleapis`に含まれるため、別途インストール不要。重複すると型エラー。

## Open Questions

1. **Zoom複数アカウント管理のスケーラビリティ**
   - What we know: 現在はアカウントA/Bの2つのみ。環境変数で管理可能。
   - What's unclear: 将来アカウントが増えた場合、環境変数が肥大化（3つ→9個、4つ→12個）。DBでZoomアカウント管理テーブルを作るべきか？
   - Recommendation: MVP（v1）では2アカウント固定。Phase 5以降で管理画面からZoomアカウントをCRUD管理できるようにする。

2. **Google Calendar API Quota超過時の代替手段**
   - What we know: 10 QPS制限、指数バックオフでリトライ。
   - What's unclear: 同時予約が10を超えた場合、リトライでも間に合わない可能性。Queue（BullMQ等）で順次処理すべきか？
   - Recommendation: Phase 4では指数バックオフのみ実装。Phase 6（自動化タスク）でQueue導入を検討。

3. **OAuth Token失効時の管理者通知**
   - What we know: Google OAuth tokenは手動で無効化可能。失効すると全てのCalendar操作が失敗。
   - What's unclear: 自動検知と管理者への通知方法。Slackアラート？メール？
   - Recommendation: Phase 4では`googleapis`のエラーをログ記録。Phase 5でAdmin Dashboardに「OAuth再認証が必要」バナーを表示。

4. **Resend送信上限とスケーリング**
   - What we know: Resend Freeプランは100通/日。Proプランは50,000通/月。
   - What's unclear: 予約が急増した場合の対応。Resend以外の選択肢（SendGrid, AWS SES）への切り替え容易性。
   - Recommendation: Phase 4では`lib/integrations/email.ts`を抽象化し、プロバイダー切り替え可能に設計。環境変数`EMAIL_PROVIDER=resend`で制御。

## Sources

### Primary (HIGH confidence)
- [Google OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server) - OAuth flow、refresh token取得方法
- [Google Calendar API Quota Management](https://developers.google.com/workspace/calendar/api/guides/quota) - Rate limit、exponential backoff推奨
- [Google Calendar API Error Handling](https://developers.google.com/workspace/calendar/api/guides/errors) - 403/429エラーハンドリング
- [googleapis Node.js Client GitHub](https://github.com/googleapis/google-api-nodejs-client) - 自動トークンリフレッシュ、TypeScript型定義
- [Zoom Server-to-Server OAuth Docs](https://developers.zoom.us/docs/internal-apps/s2s-oauth/) - S2S OAuth flow、1時間トークン有効期限
- [Resend Next.js Documentation](https://resend.com/docs/send-with-nextjs) - TypeScriptセットアップ、React Email統合

### Secondary (MEDIUM confidence)
- [OAuth Best Practices - Google](https://developers.google.com/identity/protocols/oauth2/resources/best-practices) - トークンストレージ、AES-256推奨（WebSearchで検証）
- [Saga Pattern with TypeScript - Medium](https://kisztof.medium.com/the-saga-pattern-unleashed-a-deep-dive-into-distributed-transactions-with-typescript-f7ee55d53e2d) - Orchestration vs Choreography、補償トランザクション設計
- [Google Calendar Batch Requests Guide](https://developers.google.com/workspace/calendar/api/guides/batch) - 1000リクエスト制限、クォータカウント

### Tertiary (LOW confidence)
- [Zoom API Multiple Accounts - Dev Forum](https://devforum.zoom.us/t/how-to-use-the-meeting-creation-api-with-an-account-different-from-the-one-that-registered-the-app/110886) - 複数アカウント管理の制約（要公式ドキュメント確認）
- [Best Email API for Node.js 2026 - Mailtrap](https://mailtrap.io/blog/best-email-api-for-nodejs-developers/) - Resend推奨理由（マーケティング記事、複数ソースで確認済み）

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM-HIGH - googleapis/Resendは公式ドキュメント確認済み。Zoom S2S OAuthは公式だが複数アカウント管理の詳細が不足
- Architecture: HIGH - Sagaパターン、OAuth管理、rate limitingは確立されたパターン。Phase 2実装で実績あり
- Pitfalls: MEDIUM - Google OAuth refresh token問題は公式フォーラムで頻出。Zoom複数アカウントは要検証

**Research date:** 2026-02-22
**Valid until:** 2026-03-22（30日間 - OAuth/API仕様は安定しているが、ライブラリバージョンアップを定期確認）
