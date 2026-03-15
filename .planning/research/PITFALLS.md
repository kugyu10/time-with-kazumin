# ドメイン落とし穴: コーチングセッション予約システム (ポイント管理+外部API統合)

**ドメイン:** コーチングセッション予約・ポイント管理サービス
**調査日:** 2026-02-22
**信頼度:** MEDIUM (WebSearch + 公式ドキュメント + 既存のCONCERNS.md検証)

---

## クリティカルな落とし穴

大規模な書き換えや致命的な問題を引き起こす可能性のある間違い。

### 落とし穴 1: 分散トランザクションの補償処理欠如

**何が起きるか:**
予約作成フローは8つの連続ステップ（ポイント消費 → Zoom会議作成 → Googleカレンダー追加 → メール送信）で構成される。各ステップで外部API呼び出しがあり、途中で失敗すると部分的成功状態（Zoom会議は作成されたがDBには記録されていない、ポイントは消費されたがZoomは失敗など）が発生し、システムに不整合が残る。

**なぜ起きるか:**
- 分散システムでは各ステップが独立したサービス（Zoom API、Google Calendar API、Resend）に依存している
- ネットワーク遅延、API rate limit、タイムアウトはいつでも発生する
- PostgreSQLトランザクション（ACID）は外部APIをカバーしない
- 開発者が「全ステップ成功するはず」という楽観的実装をしがち

**結果:**
- **データ不整合**: ユーザーが予約したつもりなのにZoomリンクが無効、ポイントだけ消費されている
- **ユーザー体験の崩壊**: 確認メールが届かない、カレンダーに登録されない、管理者に通知されない
- **ポイント二重消費**: 再試行時にポイント返還処理がなく、二重にポイント消費される
- **Zoom会議の孤立**: 予約DB削除後もZoom会議が残り続け、アカウント枠を圧迫

**予防策:**
1. **Sagaパターンの導入**: 各ステップに補償トランザクション（compensating transaction）を定義
   - ステップ1: ポイント消費 → 補償: ポイント返還
   - ステップ2: Zoom作成 → 補償: Zoom削除
   - ステップ3: Calendar追加 → 補償: Calendar削除
   - ステップ4: DB記録 → 補償: DB削除
   - ステップ5: メール送信 → 補償: なし（冪等性で対応）

2. **オーケストレーション vs コレオグラフィー**:
   - 小規模システムではオーケストレーション（中央管理）が推奨される
   - 単一の予約作成関数が全ステップを管理し、失敗時に補償トランザクションを順次実行

3. **トランザクション実行順序の厳格化**:
   ```
   正しい順序:
   1. DBトランザクション開始
   2. ポイント残高チェック + ロック (SELECT FOR UPDATE)
   3. 予約レコード作成 (status: 'pending')
   4. DBコミット
   5. Zoom会議作成 (失敗時 → 予約status更新 'failed', ポイント返還)
   6. Googleカレンダー追加 (失敗時 → Zoom削除, 予約status更新 'failed', ポイント返還)
   7. 予約status更新 'confirmed' + DBコミット
   8. メール送信 (非同期OK、失敗しても予約は有効)
   ```

4. **冪等性キーの導入**:
   - クライアントが生成したUUID（`Idempotency-Key`ヘッダー）をリクエストごとに送信
   - サーバーは24時間キーを保存し、同じキーでの再試行は前回のレスポンスを返す
   - ユーザーが予約ボタンを複数回押しても二重予約を防ぐ

5. **テストケース定義**:
   - 各ステップで意図的に失敗させるシナリオをモックで実装
   - 例: Zoom APIを503エラーで失敗させ、ポイント返還が正しく実行されるか検証

**検出サイン:**
- ユーザーから「ポイントが減ったのにZoomリンクがない」という報告
- 管理者ダッシュボードで `status: 'pending'` のまま24時間経過した予約
- Zoomアカウントに管理画面上存在しない会議が大量に残っている
- メール送信ログにエラーが頻発しているが予約DBは正常

**どのフェーズで対応すべきか:**
- **Phase 2 (予約作成フロー実装前)**: Saga設計完了必須
- **Phase 3 (外部API統合)**: 各API呼び出しに補償処理実装
- **Phase 4 (テスト)**: 失敗シナリオの網羅的テスト

---

### 落とし穴 2: ポイントトランザクション整合性の破綻

**何が起きるか:**
同一ユーザーが複数ブラウザ/デバイスから同時に予約を作成すると、データベースのロック競合やトランザクション分離レベルの設定ミスにより、残高100ポイントで60ポイント消費する予約を2つ同時に作成できてしまう（本来は1つだけ成功すべき）。

**なぜ起きるか:**
- PostgreSQLの`SELECT FOR UPDATE`ロックが正しく適用されていない
- Row Level Security (RLS) ポリシーとロックの競合
- トランザクション分離レベルが`READ COMMITTED`（デフォルト）でファントムリードが発生
- `consume_points`関数内で残高チェックとポイント消費の間にタイムラグがある

**結果:**
- **負のポイント残高**: 100ポイントから120ポイント消費され、残高-20になる
- **会員への返金対応**: 手動でポイント調整が必要、運用コスト増加
- **信頼性の喪失**: 「システムが不正確」という印象を与える

**予防策:**
1. **SELECT FOR UPDATE NOWAITの使用**:
   ```sql
   -- consume_points関数内
   SELECT current_points
   FROM member_plans
   WHERE member_id = p_member_id
     AND ended_at IS NULL
   FOR UPDATE NOWAIT; -- 即座にロック取得失敗ならエラー返却

   IF current_points < p_points THEN
     RAISE EXCEPTION 'Insufficient points';
   END IF;

   UPDATE member_plans
   SET current_points = current_points - p_points
   WHERE member_id = p_member_id AND ended_at IS NULL;
   ```

2. **トランザクション分離レベルの引き上げ**:
   - ポイント消費関数を`SERIALIZABLE`分離レベルで実行
   - ただし、デッドロックリスクが増加するため慎重に判断

3. **楽観的ロックの併用**:
   - `member_plans`テーブルに`version`カラムを追加
   - 更新時に`WHERE version = expected_version`条件を付与
   - バージョン不一致で更新失敗なら再試行（最大3回）

4. **API側でのリトライロジック明確化**:
   ```typescript
   async function createBooking(request: BookingRequest) {
     for (let attempt = 1; attempt <= 3; attempt++) {
       try {
         return await db.transaction(async (tx) => {
           // consume_points呼び出し
         });
       } catch (error) {
         if (error.code === '40P01' && attempt < 3) { // Deadlock detected
           await sleep(Math.random() * 1000); // Exponential backoff with jitter
           continue;
         }
         throw error;
       }
     }
   }
   ```

5. **負荷テストの実施**:
   - 同一ユーザーから100並行リクエストを送信
   - k6またはLocustで実施
   - 最終的にポイント残高が正確に一致することを検証

**検出サイン:**
- ポイント履歴（`point_transactions`）の合計が`member_plans.current_points`と一致しない
- PostgreSQLログにデッドロック警告が頻発
- ユーザーから「ポイントが減りすぎている」という報告

**どのフェーズで対応すべきか:**
- **Phase 1 (DB設計)**: `consume_points`関数に`FOR UPDATE NOWAIT`実装
- **Phase 2 (予約API実装)**: リトライロジック実装
- **Phase 4 (テスト)**: 並行リクエスト負荷テスト

---

### 落とし穴 3: 二重予約（ダブルブッキング）の発生

**何が起きるか:**
2人のユーザーが同じ時間帯のスロットを「ほぼ同時」に予約すると、どちらも空きスロットとして表示され、両方の予約が成功してしまう。これは競合状態（race condition）によるもので、トランザクション制御が不十分な場合に発生する。

**なぜ起きるか:**
- スロット空き確認と予約作成の間にタイムラグがある
- `bookings`テーブルへのINSERT前に排他制御がない
- Googleカレンダー同期の15分キャッシュにより、実際の空き状況とズレが生じる
- フロント側で「予約確定ボタン」を連打すると複数リクエストが送信される

**結果:**
- **コーチの信頼性低下**: 同じ時間に2件の予約が入り、どちらかをキャンセル対応が必要
- **ユーザー体験の悪化**: 予約確定後にキャンセル連絡が来る
- **ポイント返還処理**: 運用負荷増加

**予防策:**
1. **データベースUNIQUE制約**:
   ```sql
   -- bookingsテーブルに部分的UNIQUE制約追加
   CREATE UNIQUE INDEX unique_coach_slot
   ON bookings (coach_id, start_time)
   WHERE status != 'cancelled';
   ```
   - 同じ開始時刻で2件予約を作成しようとするとPostgreSQLがエラーを返す
   - アプリケーション層で`try-catch`してユーザーに「予約が埋まりました」と表示

2. **分散ロック（Redis）の導入**:
   - 予約作成前にRedisで`SETNX booking:2026-02-22T10:00 lock_id`を取得
   - ロック取得成功なら予約処理継続、失敗なら即座に「予約中」エラー返却
   - 予約完了/失敗後にロック解放
   - 本プロジェクトは小規模のためRedis導入はオーバースペック、DB制約で十分

3. **楽観的ロックでのスロット予約**:
   ```typescript
   // 予約作成API内
   const slot = await getAvailableSlot(startTime);
   if (!slot.isAvailable) {
     throw new Error('Slot no longer available');
   }

   // INSERT時にstatus='confirmed'で作成
   // UNIQUE制約により二重予約は自動的に失敗
   ```

4. **フロント側のボタン無効化**:
   ```typescript
   const [isSubmitting, setIsSubmitting] = useState(false);

   async function handleBooking() {
     setIsSubmitting(true); // ボタン無効化
     try {
       await createBooking();
     } finally {
       setIsSubmitting(false);
     }
   }
   ```

5. **Googleカレンダー同期の改善**:
   - キャッシュ時間を15分→5分に短縮（ユーザー数が少ない間）
   - 予約作成前に強制的に最新カレンダー取得（オプション）

**検出サイン:**
- 管理者に「同じ時間に2件予約が入っている」というアラート
- PostgreSQLで`SELECT * FROM bookings WHERE start_time = '...' AND status = 'confirmed'`が2件以上返る
- ユーザーから「予約したのにキャンセル連絡が来た」という苦情

**どのフェーズで対応すべきか:**
- **Phase 1 (DB設計)**: `bookings`テーブルにUNIQUE制約追加
- **Phase 3 (予約API実装)**: UNIQUE制約エラーハンドリング実装
- **Phase 4 (テスト)**: 並行予約シナリオテスト

---

### 落とし穴 4: OAuth トークン期限切れの未対応

**何が起きるか:**
Zoom API、Google Calendar APIはOAuth 2.0認証を使用しており、アクセストークンは30分〜1時間で期限切れになる。リフレッシュトークンで更新する処理が実装されていないと、突然全ての外部API呼び出しが`401 Unauthorized`エラーで失敗し、予約作成・カレンダー同期・Zoom会議作成が全て停止する。

**なぜ起きるか:**
- OAuth 2.0のアクセストークン短命化（セキュリティベストプラクティス2026）
- リフレッシュトークン処理を「後で実装」と先延ばしにしがち
- 開発時は手動で認証し直すため問題に気づかない
- リフレッシュトークン自体も有効期限がある（数週間〜数ヶ月）

**結果:**
- **サービス停止**: 予約システム全体が機能しなくなる
- **緊急メンテナンス**: 管理者が手動で再認証が必要
- **ユーザー離脱**: 予約できない時間帯に顧客を失う

**予防策:**
1. **リフレッシュトークン自動更新の実装**:
   ```typescript
   async function callZoomAPI(endpoint: string) {
     let token = await getStoredAccessToken('zoom_account_a');

     try {
       return await fetch(`https://api.zoom.us${endpoint}`, {
         headers: { Authorization: `Bearer ${token}` }
       });
     } catch (error) {
       if (error.status === 401) {
         // トークン期限切れ、リフレッシュ試行
         token = await refreshAccessToken('zoom_account_a');
         return await fetch(`https://api.zoom.us${endpoint}`, {
           headers: { Authorization: `Bearer ${token}` }
         });
       }
       throw error;
     }
   }

   async function refreshAccessToken(accountKey: string) {
     const refreshToken = await getStoredRefreshToken(accountKey);
     const response = await fetch('https://zoom.us/oauth/token', {
       method: 'POST',
       body: new URLSearchParams({
         grant_type: 'refresh_token',
         refresh_token: refreshToken,
       }),
     });

     const { access_token, refresh_token } = await response.json();
     await storeTokens(accountKey, access_token, refresh_token);
     return access_token;
   }
   ```

2. **トークン有効期限の事前チェック**:
   - `app_settings`テーブルに`zoom_a_token_expires_at`カラム追加
   - API呼び出し前に`if (now() > expires_at - 5分) { refresh(); }`
   - 期限切れ5分前に自動更新

3. **リフレッシュトークン自体の期限管理**:
   - リフレッシュトークンが失効した場合、管理者にSlack/メール通知
   - admin ダッシュボードに「OAuth再認証が必要」という警告表示
   - 再認証フローを実装（管理者が「Zoom再接続」ボタンをクリック）

4. **並行リクエスト時のリフレッシュ競合対策**:
   - 複数のAPI呼び出しが同時にトークン期限切れを検知すると、複数回リフレッシュが走る
   - インメモリロック（シングルインスタンス）またはRedis分散ロック（マルチインスタンス）でリフレッシュを排他制御
   ```typescript
   let refreshPromise: Promise<string> | null = null;

   async function getValidAccessToken() {
     if (refreshPromise) {
       return await refreshPromise; // 既存のリフレッシュ完了を待つ
     }

     if (isTokenExpired()) {
       refreshPromise = refreshAccessToken();
       try {
         return await refreshPromise;
       } finally {
         refreshPromise = null;
       }
     }

     return getCurrentToken();
   }
   ```

5. **定期的なトークン検証**:
   - Edge Function（cron: 毎時0分）でトークン有効性チェック
   - 失効が近い場合は事前更新、失効済みなら管理者に通知

**検出サイン:**
- Zoom API / Google Calendar APIで`401 Unauthorized`エラー頻発
- Vercelログに"Token expired"エラーが大量発生
- ユーザーから「予約ボタンを押してもエラーになる」という報告
- 管理者ダッシュボードでカレンダー同期が「最終更新: 3時間前」で止まっている

**どのフェーズで対応すべきか:**
- **Phase 2 (外部API統合設計)**: リフレッシュトークンフロー設計必須
- **Phase 3 (Zoom/Google Calendar実装)**: リフレッシュ処理実装
- **Phase 5 (監視)**: トークン有効期限監視 + 通知実装

---

## 高リスクな落とし穴

### 落とし穴 5: タイムゾーンの不整合

**何が起きるか:**
ユーザー（海外からアクセス）、Googleカレンダー（UTC）、データベース（JST）、Zoom API（UTC）の間でタイムゾーン変換ミスが発生し、予約した時刻がカレンダー・Zoom・DBで異なる時間になる。

**なぜ起きるか:**
- JavaScriptの`Date`オブジェクトはローカルタイムゾーンに依存
- Supabase Postgresは`timestamptz`（タイムゾーン付き）と`timestamp`（タイムゾーンなし）を混在させると混乱
- Zoom APIは全てUTCで返却
- フロント側で「2026-02-22T10:00」が表示タイムゾーンなのかJSTなのか不明確

**結果:**
- **予約時刻のズレ**: ユーザーは10:00 JSTを予約したつもりが、Zoomは01:00 UTC（10:00 JST）と正しいが、DBには19:00 JSTで記録される（前日）
- **コーチの混乱**: カレンダーとDB予約一覧で時刻が一致しない

**予防策:**
1. **全てUTCで統一**:
   - DBの`start_time`, `end_time`は全て`timestamptz`型でUTC保存
   - Zoom/Google APIレスポンスは全てUTCで扱う
   - フロント側では表示時のみJSTに変換

2. **タイムゾーン変換ライブラリの統一**:
   ```typescript
   import { toZonedTime, format } from 'date-fns-tz';

   // DBから取得（UTC）
   const startTimeUTC = booking.start_time; // "2026-02-22T01:00:00Z"

   // JST表示
   const startTimeJST = toZonedTime(startTimeUTC, 'Asia/Tokyo');
   const displayTime = format(startTimeJST, 'yyyy-MM-dd HH:mm', { timeZone: 'Asia/Tokyo' });
   // => "2026-02-22 10:00"
   ```

3. **フロント側でのタイムゾーン明示**:
   ```typescript
   // 悪い例
   <p>予約時刻: {booking.start_time}</p>

   // 良い例
   <p>予約時刻: {formatInTimeZone(booking.start_time, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm')} (JST)</p>
   ```

4. **API レスポンスにタイムゾーン情報を含める**:
   ```json
   {
     "start_time": "2026-02-22T10:00:00+09:00",
     "timezone": "Asia/Tokyo"
   }
   ```

5. **テストケース**:
   - 異なるタイムゾーンからの予約シミュレーション（UTC+9, UTC-5, UTCなど）
   - DBに保存された時刻がUTCで正しいか検証

**検出サイン:**
- カレンダーとDB予約一覧で時刻が9時間ズレている
- ユーザーから「予約した時間が違う」という報告
- Zoomリンクの開始時刻が予約時刻と異なる

**どのフェーズで対応すべきか:**
- **Phase 1 (DB設計)**: 全カラムを`timestamptz`に統一
- **Phase 2 (API設計)**: タイムゾーン変換ルール策定
- **Phase 3 (実装)**: date-fns-tz導入
- **Phase 4 (テスト)**: タイムゾーンテスト実施

---

### 落とし穴 6: Google Calendar API Rate Limiting

**何が起きるか:**
Google Calendar APIには無料枠で**10 QPS**（秒間10リクエスト）、**1日100万リクエスト**の制限がある。複数ユーザーが同時にスロット取得すると、オンデマンド同期戦略（15分キャッシュ）でもレートリミットに引っかかり、`403 Rate Limit Exceeded`エラーで全スロット取得が失敗する。

**なぜ起きるか:**
- `app_settings.last_calendar_sync`の更新が競合状態になる
- 15分経過直後に10人が同時アクセスすると10回API呼び出しが発生
- Vercel Serverlessは各リクエストが独立したコンテナで実行されるため、メモリ共有ができない
- Google Calendar APIは祝日カレンダー取得でも1リクエスト消費

**結果:**
- **スロット取得エラー**: ユーザーに「予約可能な時間が表示されません」エラー
- **サービス停止**: レートリミット到達で数時間スロット取得不可
- **ユーザー離脱**: 予約できないため他サービスに流れる

**予防策:**
1. **同期処理の排他制御**:
   ```sql
   -- app_settingsテーブル更新をトランザクションで保護
   BEGIN;
   SELECT last_calendar_sync FROM app_settings WHERE key = 'calendar_sync' FOR UPDATE;

   IF (last_calendar_sync < now() - interval '15 minutes') THEN
     -- Google Calendar API呼び出し
     UPDATE app_settings SET last_calendar_sync = now() WHERE key = 'calendar_sync';
   END IF;
   COMMIT;
   ```
   - 最初のリクエストだけがAPI呼び出し権を獲得、他は待機

2. **Redisでの同期フラグ管理**:
   ```typescript
   async function syncCalendar() {
     const isLocked = await redis.set('calendar_sync_lock', '1', {
       NX: true, // キーが存在しない場合のみ設定
       EX: 60,   // 60秒後に自動削除
     });

     if (!isLocked) {
       // 既に同期中、キャッシュデータを返す
       return getCachedSlots();
     }

     try {
       const events = await fetchGoogleCalendar();
       await cacheSlots(events);
       return events;
     } finally {
       await redis.del('calendar_sync_lock');
     }
   }
   ```

3. **バックオフ戦略の実装**:
   ```typescript
   async function callGoogleCalendarAPI(retries = 3) {
     for (let i = 0; i < retries; i++) {
       try {
         return await calendar.events.list(...);
       } catch (error) {
         if (error.code === 403 && error.message.includes('Rate Limit')) {
           const delay = Math.pow(2, i) * 1000 + Math.random() * 1000; // Exponential backoff with jitter
           await sleep(delay);
           continue;
         }
         throw error;
       }
     }
     throw new Error('Google Calendar API rate limit exceeded');
   }
   ```

4. **Cronバッチへの早期切り替え**:
   - ユーザー20人超または週10件以上の予約でcronバッチ導入
   - Supabase Edge Function: 毎15分でカレンダー取得 → DBキャッシュ保存
   - スロット取得APIはDBキャッシュのみ参照（Google API呼び出しゼロ）

5. **キャッシュ時間の動的調整**:
   - 通常時: 15分キャッシュ
   - レートリミット検出時: 60分キャッシュに自動延長

**検出サイン:**
- Vercelログに`403 Rate Limit Exceeded`エラー頻発
- ユーザーから「予約画面が真っ白」という報告
- admin ダッシュボードで「最終同期: エラー」表示

**どのフェーズで対応すべきか:**
- **Phase 3 (カレンダー同期実装)**: 排他制御 + バックオフ実装
- **Phase 4 (テスト)**: 並行スロット取得負荷テスト
- **Phase 5 (スケール対策)**: ユーザー20人到達前にcronバッチ実装

---

### 落とし穴 7: Vercel Serverless 10秒タイムアウト（無料プラン）

**何が起きるか:**
予約作成フロー（ポイント消費 + Zoom作成 + Google Calendar + Resend）が複数の外部API呼び出しを含むため、応答時間が10秒を超えると`FUNCTION_INVOCATION_TIMEOUT`エラーでリクエストが強制終了する。ユーザーにはエラーが返るが、途中まで実行された処理（Zoom会議作成など）はロールバックされない。

**なぜ起きるか:**
- Zoom API: 平均200ms、最大1秒
- Google Calendar API: 平均300ms、最大2秒
- Resend API: 平均100ms、最大500ms
- ネットワーク遅延、リトライ、DB処理を合計すると10秒に近づく
- Vercel無料プランは10秒、Pro（$20/月）は60秒

**結果:**
- **予約失敗**: ユーザーに「タイムアウトエラー」表示
- **不整合状態**: Zoom会議は作成されたがDBには記録されていない
- **ユーザー再試行で二重予約**: ユーザーが再度ボタンを押すと二重予約が発生

**予防策:**
1. **非同期処理への分離**:
   ```typescript
   // 同期処理（10秒以内で完了）
   async function createBooking(request) {
     // 1. ポイント消費 + DB記録（status: 'pending'）
     const booking = await db.transaction(async (tx) => {
       await consumePoints(tx, memberId, points);
       return await tx.bookings.insert({ status: 'pending', ... });
     });

     // 2. 非同期ジョブをキューに追加
     await queue.enqueue('finalize-booking', { bookingId: booking.id });

     // 3. 即座にレスポンス返却（Zoom/Calendar処理は非同期）
     return { success: true, bookingId: booking.id, status: 'pending' };
   }

   // 非同期ジョブ（Supabase Edge Functionまたはバックグラウンドワーカー）
   async function finalizeBooking(bookingId) {
     const zoom = await createZoomMeeting(...);
     await addToGoogleCalendar(...);
     await db.bookings.update({ id: bookingId, status: 'confirmed', zoom_link: zoom.join_url });
     await sendConfirmationEmail(...);
   }
   ```

2. **Vercel Proへの早期移行**:
   - ユーザー10人超または週5件以上の予約でPro検討
   - $20/月で60秒タイムアウト、バックグラウンドジョブ対応

3. **並列処理でのレイテンシ短縮**:
   ```typescript
   // 悪い例（逐次処理: 200ms + 300ms + 100ms = 600ms）
   const zoom = await createZoomMeeting();
   const calendar = await addToGoogleCalendar();
   const email = await sendEmail();

   // 良い例（並列処理: max(200ms, 300ms, 100ms) = 300ms）
   const [zoom, calendar, email] = await Promise.all([
     createZoomMeeting(),
     addToGoogleCalendar(),
     sendEmail(),
   ]);
   ```
   - ただし、並列処理は失敗時のロールバックが複雑になるため慎重に

4. **タイムアウト監視とアラート**:
   - Vercelログで`FUNCTION_INVOCATION_TIMEOUT`を検知
   - Slackに通知
   - admin ダッシュボードに「タイムアウト発生件数」表示

5. **冪等性キーの必須化**:
   - タイムアウトでユーザーが再試行しても二重処理されない

**検出サイン:**
- Vercelログに`FUNCTION_INVOCATION_TIMEOUT`エラー
- ユーザーから「予約ボタンを押してもずっと読み込み中」という報告
- Zoomアカウントに孤立した会議が増えている

**どのフェーズで対応すべきか:**
- **Phase 2 (アーキテクチャ設計)**: 非同期処理設計
- **Phase 3 (実装)**: 並列処理 + 冪等性キー実装
- **Phase 5 (運用)**: Vercel Pro移行検討

---

### 落とし穴 8: キャンセルポリシーの実装漏れ

**何が起きるか:**
ユーザーがセッション開始5分前にキャンセルしてもポイントが全額返還される、または逆に24時間前のキャンセルでも返還されないなど、キャンセルポリシーが曖昧だとユーザーとのトラブルに発展する。

**なぜ起きるか:**
- 要件定義でキャンセルポリシーが「MVP後」とスコープ外にされている
- 「とりあえず全額返還」の暫定実装が本番に残る
- ビジネスルールをコードに落とし込む際の解釈ミス

**結果:**
- **収益損失**: 直前キャンセルでも全額返還 → コーチの時間枠が埋まり他予約を逃す
- **ユーザー不満**: 返還ルールが不明確 → 「返金されると思った」とクレーム
- **運用負荷**: 手動でポイント調整が頻発

**予防策:**
1. **キャンセルポリシーの明確化**:
   ```
   - 24時間前まで: 全額返還（100%）
   - 24時間〜3時間前: 50%返還
   - 3時間以内: 返還なし（0%）
   - 管理者キャンセル: 常に全額返還
   ```

2. **DB実装**:
   ```sql
   -- bookings テーブル
   cancelled_at timestamptz,
   refund_points integer DEFAULT 0,

   -- キャンセル時の処理
   CREATE FUNCTION cancel_booking(p_booking_id uuid) RETURNS void AS $$
   DECLARE
     v_start_time timestamptz;
     v_points integer;
     v_refund_points integer;
   BEGIN
     SELECT start_time, points_consumed INTO v_start_time, v_points
     FROM bookings WHERE id = p_booking_id;

     IF v_start_time - now() >= interval '24 hours' THEN
       v_refund_points := v_points; -- 全額返還
     ELSIF v_start_time - now() >= interval '3 hours' THEN
       v_refund_points := v_points / 2; -- 50%返還
     ELSE
       v_refund_points := 0; -- 返還なし
     END IF;

     UPDATE bookings SET status = 'cancelled', cancelled_at = now(), refund_points = v_refund_points
     WHERE id = p_booking_id;

     INSERT INTO point_transactions (member_id, points, transaction_type, booking_id)
     VALUES (member_id, v_refund_points, 'refund', p_booking_id);

     UPDATE member_plans SET current_points = current_points + v_refund_points
     WHERE member_id = (SELECT member_id FROM bookings WHERE id = p_booking_id);
   END;
   $$ LANGUAGE plpgsql;
   ```

3. **UI表示**:
   - 予約画面に「キャンセルポリシー」を明示
   - キャンセルボタン押下時に「返還ポイント: XX」を表示して確認

4. **メール通知**:
   - キャンセルメールに「返還ポイント: XX」を記載

5. **admin 管理機能**:
   - 管理者は常に全額返還でキャンセル可能
   - 例外対応（ユーザーの事情を考慮した全額返還）も可能

**検出サイン:**
- ユーザーから「キャンセルしたのにポイントが返ってこない」という問い合わせ
- 管理者から「直前キャンセルが多すぎる」という報告

**どのフェーズで対応すべきか:**
- **Phase 1 (要件定義)**: キャンセルポリシー確定
- **Phase 2 (DB設計)**: `cancel_booking`関数実装
- **Phase 3 (実装)**: UI + メール通知実装
- **MVP後**: ポリシー調整（データ分析に基づく）

---

### 落とし穴 9: Row Level Security (RLS) ポリシーのパフォーマンス劣化

**何が起きるか:**
Supabase RLSポリシーが複数の`EXISTS`サブクエリ（admin判定など）を使用していると、大量レコードアクセス時にクエリが遅延し、API タイムアウトが発生する。特に管理者が500件の予約一覧を取得する際、500回の`profiles`テーブルEXISTSクエリが実行される可能性がある。

**なぜ起きるか:**
- RLSポリシーは全行に対して評価される
- サブクエリはインデックスが効かない場合がある
- Supabase `auth.uid()`の評価コストが高い

**結果:**
- **管理画面の遅延**: 予約一覧が10秒以上表示されない
- **API タイムアウト**: Vercel 10秒制限に引っかかる
- **ユーザー体験の悪化**: 管理者が「システムが重い」と感じる

**予防策:**
1. **JWT Claimベースの権限チェック**:
   ```sql
   -- 悪い例（EXISTS サブクエリ）
   CREATE POLICY admin_all ON bookings FOR ALL
   USING (
     EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
   );

   -- 良い例（JWT claim）
   CREATE POLICY admin_all ON bookings FOR ALL
   USING (
     (auth.jwt() ->> 'role') = 'admin'
   );
   ```
   - Supabase Authの`app_metadata`に`role: 'admin'`を追加
   - JWT生成時に自動的にclaimに含まれる

2. **インデックスの追加**:
   ```sql
   CREATE INDEX idx_profiles_role ON profiles(role);
   CREATE INDEX idx_bookings_member_id ON bookings(member_id);
   ```

3. **`security_definer`関数の使用**:
   ```sql
   -- RLSをバイパスする管理者専用関数
   CREATE FUNCTION admin_get_all_bookings()
   RETURNS TABLE(id uuid, start_time timestamptz, ...)
   SECURITY DEFINER -- 関数所有者の権限で実行
   SET search_path = public
   AS $$
   BEGIN
     -- auth.uid()が管理者かチェック
     IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
       RAISE EXCEPTION 'Unauthorized';
     END IF;

     RETURN QUERY SELECT * FROM bookings; -- RLS bypass
   END;
   $$ LANGUAGE plpgsql;
   ```

4. **クエリプランの確認**:
   ```sql
   EXPLAIN ANALYZE SELECT * FROM bookings WHERE member_id = auth.uid();
   ```
   - Seq Scanが発生していないか確認
   - Index Scanが使用されているか確認

5. **負荷テスト**:
   - 500件の予約データを作成
   - 管理者アカウントで全件取得
   - レスポンスタイムが3秒以内か検証

**検出サイン:**
- Supabaseダッシュボードで「Slow Queries」に頻繁に表示される
- 管理画面が10秒以上読み込み続ける
- PostgreSQLログに`duration: 5000ms`などの長時間クエリ

**どのフェーズで対応すべきか:**
- **Phase 1 (DB設計)**: JWT claim設計
- **Phase 2 (RLS実装)**: JWT claimベースのポリシー実装
- **Phase 4 (テスト)**: 大量データでの負荷テスト

---

## 中リスクな落とし穴

### 落とし穴 10: メール送信失敗の未検知

**何が起きるか:**
Resend APIでメール送信が失敗しても、予約処理は成功として扱われ、ユーザーに確認メールが届かない。ユーザーは「予約できたか不安」になり、管理者も気づかない。

**なぜ起きるか:**
- メール送信を`await`せずに`fire-and-forget`で実装
- Resendがレートリミット（月3000通）到達でエラー
- 無効なメールアドレスで送信試行

**予防策:**
1. **メール送信結果のロギング**:
   ```typescript
   try {
     await resend.emails.send({
       from: 'no-reply@example.com',
       to: user.email,
       subject: '予約確認',
       html: '<p>...',
     });
     await db.email_logs.insert({ booking_id, status: 'sent' });
   } catch (error) {
     await db.email_logs.insert({ booking_id, status: 'failed', error: error.message });
     // Slackに通知
     await notifyAdmin(`メール送信失敗: ${booking_id}`);
   }
   ```

2. **リトライ機構の実装**:
   ```typescript
   async function sendEmailWithRetry(email, retries = 3) {
     for (let i = 0; i < retries; i++) {
       try {
         return await resend.emails.send(email);
       } catch (error) {
         if (i < retries - 1 && isRetryableError(error)) {
           await sleep(Math.pow(2, i) * 1000); // Exponential backoff
           continue;
         }
         throw error;
       }
     }
   }
   ```

3. **admin ダッシュボードでの可視化**:
   - 「最近のメール送信エラー」表示
   - 月間送信数 / 月間制限（3000通）のゲージ

4. **バックアップメール送信**:
   - Resend失敗時にPostmark等の代替サービスに自動切り替え

**どのフェーズで対応すべきか:**
- **Phase 3 (メール送信実装)**: ロギング + リトライ実装
- **Phase 5 (監視)**: admin ダッシュボード実装

---

### 落とし穴 11: Supabase Edge Function (Cron) の実行失敗

**何が起きるか:**
月次ポイント付与、リマインダー送信、サンキューメール送信のEdge Function (Deno) がクラッシュまたは遅延しても、エラーが検知されず、ユーザーへの影響が数日後に発覚する。

**なぜ起きるか:**
- Edge Functionの実行ログがSupabaseダッシュボードにしか表示されない
- cron失敗時のアラート機構がない
- タイムゾーン設定ミスで実行時刻がズレる

**予防策:**
1. **実行ログの外部保存**:
   ```typescript
   // supabase/functions/monthly-point-grant/index.ts
   Deno.serve(async (req) => {
     const startTime = Date.now();
     try {
       const result = await grantMonthlyPoints();
       await supabase.from('cron_logs').insert({
         function_name: 'monthly-point-grant',
         status: 'success',
         duration_ms: Date.now() - startTime,
         result,
       });
       return new Response(JSON.stringify({ success: true }));
     } catch (error) {
       await supabase.from('cron_logs').insert({
         function_name: 'monthly-point-grant',
         status: 'error',
         duration_ms: Date.now() - startTime,
         error: error.message,
       });
       // Slack通知
       await fetch(process.env.SLACK_WEBHOOK_URL, {
         method: 'POST',
         body: JSON.stringify({ text: `月次ポイント付与失敗: ${error.message}` }),
       });
       throw error;
     }
   });
   ```

2. **タイムゾーン明示**:
   ```typescript
   // 毎月1日 00:00 JST = 前日 15:00 UTC
   // supabase functions deploy --schedule "0 15 * * *"
   ```

3. **冪等性の保証**:
   ```sql
   -- 同じ月に複数回実行されても問題ないように
   INSERT INTO point_transactions (member_id, points, transaction_type, granted_month)
   SELECT member_id, plan_points, 'monthly_grant', '2026-02'
   FROM member_plans
   WHERE ended_at IS NULL
   ON CONFLICT (member_id, granted_month) DO NOTHING; -- 重複実行を防ぐ
   ```

4. **admin ダッシュボードでの可視化**:
   - 「Cron実行履歴」表示
   - 最終実行時刻、ステータス、エラーメッセージ

**どのフェーズで対応すべきか:**
- **Phase 5 (Cron実装)**: ロギング + Slack通知実装

---

### 落とし穴 12: ゲスト予約のレートリミット未実装

**何が起きるか:**
ゲスト予約は認証なしで`POST /api/bookings`を呼べるため、悪意あるユーザーが数千件の予約を作成し、Zoom API rate limitに到達して正当な予約まで作成不可になる。

**なぜ起きるか:**
- 要件定義でゲスト予約は「名前+メールのみ」と手軽さを優先
- DDoS対策が後回しにされる

**予防策:**
1. **IP単位のレートリミット**:
   ```typescript
   // middleware.ts (Vercel Edge Middleware)
   import { Ratelimit } from '@upstash/ratelimit';
   import { Redis } from '@upstash/redis';

   const ratelimit = new Ratelimit({
     redis: Redis.fromEnv(),
     limiter: Ratelimit.slidingWindow(5, '1 h'), // 1時間で5予約
   });

   export async function middleware(req: Request) {
     const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
     const { success } = await ratelimit.limit(ip);

     if (!success) {
       return new Response('Too many requests', { status: 429 });
     }

     return NextResponse.next();
   }
   ```

2. **メール単位のレートリミット**:
   ```typescript
   // API内
   const emailLimit = await ratelimit.limit(`email:${guestEmail}`);
   if (!emailLimit.success) {
     return res.status(429).json({ error: '同じメールアドレスで24時間以内に3件以上予約できません' });
   }
   ```

3. **Captcha導入**:
   - reCAPTCHA v3をゲスト予約フォームに導入
   - ボット判定スコアが0.5以下なら予約拒否

**どのフェーズで対応すべきか:**
- **Phase 3 (ゲスト予約実装)**: レートリミット実装
- **Phase 4 (テスト)**: 負荷テスト

---

## 低リスクな落とし穴

### 落とし穴 13: 環境変数の管理不備

**何が起きるか:**
`.env.local`にZoom A/B、Google、Resendなど複数のcredentialsがあり、新しい開発者が環境構築時にどのcredentialを取得すればいいか分からず、開発が遅延する。

**予防策:**
1. `.env.local.example`の作成
2. READMEに各サービスの設定手順を記載
3. 1PasswordまたはGitHub Secrets で集中管理

**どのフェーズで対応すべきか:**
- **Phase 0 (開発環境構築)**: `.env.local.example`作成

---

### 落とし穴 14: データベースマイグレーションのロールバック未定義

**何が起きるか:**
Supabase migrationsでUP scriptのみ定義し、DOWN scriptがないため、プロダクション適用後にロールバックできない。

**予防策:**
1. 全マイグレーションにUP + DOWNを定義
2. ステージング環境で事前テスト
3. GitHub ActionsでCI/CD自動化

**どのフェーズで対応すべきか:**
- **Phase 1 (DB設計)**: マイグレーション作成時にDOWN定義必須

---

### 落とし穴 15: TypeScript型とDB schemaの不一致

**何が起きるか:**
マイグレーション後に`supabase gen types`を実行し忘れると、TypeScript型が古いままでランタイムエラーが発生する。

**予防策:**
1. `supabase gen types`をCI/CDパイプラインに組み込み
2. Pre-commit hookで型同期確認
3. Vercel デプロイ前に自動type check

**どのフェーズで対応すべきか:**
- **Phase 1 (開発環境構築)**: CI/CD設定

---

## E2Eテスト固有の落とし穴 (v1.2 追記)

**追記日:** 2026-03-15
**対象スタック:** Next.js 15 App Router + Supabase Auth + Vercel + Playwright
**信頼度:** MEDIUM-HIGH (公式ドキュメント + WebSearch複数ソース検証)

---

### E2E落とし穴 1: Google OAuth をPlaywrightで自動化しようとする

**何が起きるか:**
Googleの OAuth 同意画面を Playwright で自動クリックしようとすると、Googleが「不審なアクセス」と判断し、追加確認（電話番号、CAPTCHA等）を要求してきてテストが必ず失敗する。これはGoogle の Bot検出が機能しているため回避不可能。

**なぜ起きるか:**
- Googleはヘッドレスブラウザ、自動化ツール、地域・ブラウザの組み合わせによって異なるOAuth フローを返す
- CI/CD環境ではIPアドレス、ブラウザのUser-Agent等からBot判定される確率が高い
- Supabaseのdiscussionでも「確実な方法はない」と公式に認められている

**結果:**
- **テスト全滅**: Google OAuthを前提とする全テストがCI/CDで非決定論的に失敗
- **開発生産性の低下**: ローカルでは通るがCIで落ちる不安定な状態が続く

**予防策:**
1. **Google OAuth テストは完全にスキップ** — E2Eテストの対象外にする。OAuthフローが「機能している」前提でテストを設計する
2. **Supabase REST API経由でセッションを直接作成**:
   ```typescript
   // tests/auth.setup.ts
   import { createClient } from '@supabase/supabase-js';

   const supabase = createClient(
     process.env.SUPABASE_TEST_URL!,
     process.env.SUPABASE_ANON_KEY!
   );

   // メール/パスワード認証でテストユーザーを直接ログイン
   const { data } = await supabase.auth.signInWithPassword({
     email: 'test-member@example.com',
     password: process.env.TEST_USER_PASSWORD!,
   });

   // セッションをlocalStorageに保存してPlaywrightで再利用
   await page.evaluate((session) => {
     localStorage.setItem('sb-xxxxx-auth-token', JSON.stringify(session));
   }, data.session);
   ```
3. **Playwright storageState でセッション再利用**:
   ```typescript
   // playwright.config.ts
   projects: [
     { name: 'setup', testMatch: '**/auth.setup.ts' },
     {
       name: 'authenticated',
       dependencies: ['setup'],
       use: { storageState: '.auth/member.json' },
     },
   ]
   ```

**検出サイン:**
- CI/CDで「追加確認が必要」または「reCAPTCHAを解いてください」画面でテストが止まる
- ローカルでは通るのにCIで`TimeoutError`が出る

**どのフェーズで対応すべきか:**
- **E2E環境構築フェーズ（最初）**: 認証戦略を最初に決定する。後から変えると全テスト書き直しになる

---

### E2E落とし穴 2: テストデータが本番/開発DBを汚染する

**何が起きるか:**
E2Eテストが本番または開発で使っているSupabaseプロジェクトに対して実行されると、テスト用の予約・ユーザー・ポイント履歴がDBに残り続け、本番データと混在して管理者が混乱する。

**なぜ起きるか:**
- テスト用に別のSupabaseプロジェクト（またはローカル環境）を用意していない
- テスト後にデータをクリーンアップする処理が未実装
- 環境変数で分岐していないため、テスト実行時の接続先が不明確

**結果:**
- **本番データの汚染**: 管理者がダッシュボードで「テスト予約」を誤って処理
- **Zoom API 汚染**: テスト用Zoom会議が本番アカウントに作成される
- **Resend 汚染**: テスト用確認メールが実在するメールアドレスに誤送信

**予防策:**
1. **Supabase ローカル開発環境を E2E 専用に使う**:
   ```bash
   # .env.test.local
   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
   - `supabase start` でローカルインスタンスを起動
   - テスト前に `supabase db reset` でDBをリセット

2. **テストユーザーを専用メールアドレスで管理**:
   ```
   test-member@test.example.com  (会員テスト用)
   test-admin@test.example.com   (管理者テスト用)
   test-guest@test.example.com   (ゲストテスト用)
   ```
   - これらのメールアドレスは実在しないドメインを使用し、Resendに届かないようにする

3. **外部API（Zoom/Google Calendar/Resend）はE2Eテストでモック**:
   ```typescript
   // tests/mocks/zoom.ts
   await page.route('https://api.zoom.us/**', async (route) => {
     await route.fulfill({
       status: 200,
       body: JSON.stringify({ id: 'mock-meeting-id', join_url: 'https://zoom.us/j/mock' }),
     });
   });
   ```

4. **Supawright ライブラリの活用**（オプション）:
   - テスト後に自動でDB レコードをクリーンアップ
   - 外部キー制約を考慮した再帰的削除

**検出サイン:**
- 本番ダッシュボードに `test-` プレフィックスの予約が表示される
- Zoomアカウントに会議が大量に作成されている
- テスト後に毎回手動でDBをクリーンアップしている

**どのフェーズで対応すべきか:**
- **E2E環境構築フェーズ（最初）**: ローカルSupabase + 環境変数分岐を最初に設定
- **外部API モック実装フェーズ**: Playwright の `page.route()` でZoom/Resendをモック

---

### E2E落とし穴 3: Next.js App Router の Server Actions がflakeyになる

**何が起きるか:**
Next.js 15 App Router の Server Actions（予約作成、キャンセルなど）を呼び出すテストで、ボタンクリック後にUIが更新されたかどうかをassertするタイミングが不安定になる。ハイドレーション前にクリックしてしまったり、Server Action完了前にassertしてしまう。

**なぜ起きるか:**
- Server Components はサーバーで HTML を生成し、Client Components はハイドレーション後に動的になる
- ハイドレーション前はボタンが視覚的には存在しても、クリックが登録されない（Event Listener がまだついていない）
- `await page.click()` はDOMの存在を確認するが、ハイドレーション完了は確認しない
- Server Action の完了は非同期であり、UIへの反映にラグがある

**結果:**
- **断続的テスト失敗**: ローカルでは通るがCI（低スペックのマシン）で失敗する
- **`TimeoutError: waiting for locator`**: 既に表示されているはずの要素が見つからない

**予防策:**
1. **`page.waitForLoadState('networkidle')` ではなく要素待機を使う**:
   ```typescript
   // 悪い例（ハイドレーション完了を保証しない）
   await page.click('button[type="submit"]');
   await page.waitForTimeout(1000); // sleep は絶対NG

   // 良い例（UIの状態変化を明示的に待つ）
   await page.click('button[type="submit"]');
   await page.waitForSelector('text=予約が完了しました', { timeout: 10000 });
   ```

2. **ハイドレーション完了を待つパターン**:
   ```typescript
   // フォームが操作可能になるまで待つ
   await page.waitForSelector('form button[type="submit"]:not([disabled])');
   await page.click('form button[type="submit"]');
   ```

3. **Server Action の完了を network レベルで待つ**:
   ```typescript
   // Server Action は内部的に POST リクエストを送る
   const responsePromise = page.waitForResponse(
     (response) => response.url().includes('/_next/') && response.status() === 200
   );
   await page.click('button[type="submit"]');
   await responsePromise;
   ```

4. **開発サーバーではなく本番ビルドでテスト**:
   ```typescript
   // playwright.config.ts
   webServer: {
     command: 'npm run build && npm run start', // dev サーバーではなく本番ビルド
     url: 'http://localhost:3000',
   }
   ```
   - 開発サーバーはHot Reload等の追加動作があり、本番と挙動が異なる

**検出サイン:**
- `--retries=3` をつけると通るが、0回では失敗するテストがある
- CI環境（GitHub Actions）でのみ失敗するが、ローカルでは常に通る

**どのフェーズで対応すべきか:**
- **E2E実装フェーズ**: playwright.config.ts設定時に `webServer` を本番ビルドに設定

---

### E2E落とし穴 4: page.route() でサーバーサイドの外部API呼び出しをモックできない

**何が起きるか:**
Playwright の `page.route()` はブラウザ（クライアント）側のリクエストしかインターセプトできない。Next.js App Router の Server Components や Route Handlers から呼ぶ Zoom API / Google Calendar API / Resend はサーバーサイドで実行されるため、`page.route()` では**モックできない**。

**なぜ起きるか:**
- `page.route()` は Chromium の DevTools Protocol を使ったブラウザレベルのインターセプトであり、Node.js プロセスの HTTP リクエストは対象外
- Next.js のサーバーサイドコード（Route Handlers, Server Actions）から行う外部API呼び出しは、ブラウザを経由しない

**結果:**
- **実際の外部APIが呼ばれる**: E2Eテスト中にZoom APIが本当に会議を作成し、Resendがメールを送信する
- **テストが外部サービスの可用性に依存**: Zoom APIが落ちるとテストが全落ちする
- **コスト発生**: Zoom API / Resend の無料枠を消費する

**予防策:**
1. **Next.js 15 の `experimental.testProxy` + MSW を使う**（推奨、MEDIUM信頼度）:
   ```typescript
   // next.config.ts
   experimental: {
     testProxy: true, // サーバーサイドリクエストもMSWでインターセプト可能になる
   }
   ```
   - MSW v2 + Playwright + Next.js 15 の組み合わせでサーバーサイドモックが可能
   - ただし `experimental` フラグであり、本番環境では無効化する必要がある

2. **環境変数フラグで外部API呼び出し自体を切り替える**（シンプルで確実、HIGH信頼度）:
   ```typescript
   // lib/zoom.ts
   export async function createZoomMeeting(params) {
     if (process.env.E2E_MOCK_EXTERNAL_APIS === 'true') {
       return { id: 'mock-meeting-123', join_url: 'https://zoom.us/j/mock123' };
     }
     // 実際の Zoom API 呼び出し
   }
   ```
   ```bash
   # .env.test.local
   E2E_MOCK_EXTERNAL_APIS=true
   ```
   - E2Eテスト時のみ外部API呼び出しをスタブに切り替える
   - 最もシンプルで確実な方法

3. **HTTP プロキシを使ったサーバーサイドモック**:
   - `mitmproxy` などのプロキシをテスト時に起動
   - `HTTPS_PROXY` 環境変数でNext.jsサーバーをプロキシ経由にする
   - 実装コストが高いため小規模プロジェクトでは過剰

**検出サイン:**
- E2Eテスト後にZoomアカウントに会議が実際に作成されている
- テスト実行のたびにResendからメールが届く
- Zoom API の rate limit に達してテストが失敗する

**どのフェーズで対応すべきか:**
- **E2E環境構築フェーズ（最初）**: 外部APIモック戦略を先に決める。後から追加すると全APIクライアントの書き直しになる

---

### E2E落とし穴 5: Vercel プレビューデプロイのDeployment Protection

**何が起きるか:**
VercelのDeployment Protectionが有効になっているプレビューデプロイに対してPlaywrightでテストを実行すると、Vercelの認証ページ（パスワード入力）でPlaywrightが止まり、テストが全て失敗する。

**なぜ起きるか:**
- Vercel のDeployment Protectionは、プレビューURLへのアクセスにVercelログインまたはパスワードを要求する
- Playwrightはこの認証画面をアプリのページと区別できず、テスト対象のページにたどり着けない

**結果:**
- **CI/CDが機能しない**: プレビューデプロイへのE2Eテストが全て失敗
- **想定外のコスト**: 「Protection Bypass for Automation」機能はVercel Proプラン（月$150）が必要

**予防策:**
1. **Vercel のDeployment Protectionを無効化**（最も簡単）:
   - Vercel ダッシュボード → Settings → Deployment Protection → None
   - ただし、プレビューURLが外部に公開される点は注意

2. **プレビューデプロイへのE2Eテストは行わず、ローカルビルドに絞る**（推奨）:
   - E2Eテストは `npm run build && npm start` のローカルビルドに対して実行
   - Vercelプレビューは手動確認で対応
   - コスト・実装コストがゼロ

3. **GitHub Actions の `deployment_status` イベントを使う**（本格的な対応）:
   ```yaml
   # .github/workflows/e2e.yml
   on:
     deployment_status:
   jobs:
     e2e:
       if: github.event.deployment_status.state == 'success'
       steps:
         - name: Run Playwright tests
           env:
             BASE_URL: ${{ github.event.deployment_status.target_url }}
           run: npx playwright test
   ```
   - `patrickedqvist/wait-for-vercel-preview@v1.2.0` アクションで Deployment URL を取得

**検出サイン:**
- GitHub ActionsのPlaywrightレポートで全テストが「Failed: TimeoutError waiting for selector」
- PlaywrightのトレースでVercelのログイン画面が表示されている

**どのフェーズで対応すべきか:**
- **E2E環境構築フェーズ**: CI設定時にVercel Deployment Protectionの扱いを決定

---

### E2E落とし穴 6: Supabase の httpOnly Cookie とPlaywright storageState の相性問題

**何が起きるか:**
Supabase SSR（`@supabase/ssr`）を使っている場合、認証セッションは `httpOnly` Cookie に保存される。Playwright の `storageState` は Cookie を取得できるが、`httpOnly` の Cookie は JavaScript からは読み取れないため、`page.evaluate()` でのセッション注入が機能しない。

**なぜ起きるか:**
- `@supabase/ssr` は PKCE フローをデフォルトで使用し、セッションを httpOnly Cookie で管理する
- `httpOnly` Cookie はクライアントJS（Playwright の `evaluate`）からは見えない
- Supabaseの旧パッケージ（`@supabase/auth-helpers-nextjs`）は localStorage を使っていたため、従来の storageState が機能していた

**結果:**
- **認証セッションが引き継がれない**: storageState を設定しても認証済み状態にならない
- **全テストがログインページにリダイレクト**: 認証が必要なページへのアクセスが常にリダイレクトされる

**予防策:**
1. **Playwright の `storageState` で Cookie ごと保存する**（正しい方法）:
   ```typescript
   // tests/auth.setup.ts
   // まず実際にUIからログイン（REST API経由で）
   const { data } = await supabase.auth.signInWithPassword({
     email: 'test@example.com',
     password: 'password',
   });

   // Supabase がCookieをセットするページを一度開く
   await page.goto('/auth/callback?...');

   // Cookie 含めた全状態を保存
   await page.context().storageState({ path: '.auth/member.json' });
   ```

2. **`supabase.auth.setSession()` ではなくページ遷移でCookieをセット**:
   - Supabase SSR では Cookie は Next.js サーバーサイドでセットされる
   - Playwright から直接 Cookie を書き込むより、認証フロー（`/auth/callback`）を経由させる方が確実

3. **テスト専用にCLIでユーザー作成**:
   ```bash
   # supabase ローカル環境でテストユーザーを作成
   supabase auth user create --email test@example.com --password password123
   ```

**検出サイン:**
- storageState を設定しているのに `/login` にリダイレクトされる
- Playwright の Network タブで Supabase の Cookie が設定されていない

**どのフェーズで対応すべきか:**
- **E2E認証フロー実装フェーズ**: `@supabase/ssr` の Cookie 動作を理解してから実装

---

### E2E落とし穴 7: テスト並行実行によるDB競合

**何が起きるか:**
Playwright のデフォルト設定（`fullyParallel: true`）でテストを並行実行すると、同じテストユーザーに対して複数のテストが同時にDB操作を行い、テストが干渉し合って失敗する。例えば、「ポイント消費テスト」と「ポイント残高確認テスト」が同時実行されると、ポイント残高の期待値がズレる。

**なぜ起きるか:**
- Playwright はデフォルトでCPUコア数に合わせてワーカーを起動する
- 全テストが同一のテストユーザーアカウントを使い回している
- E2Eテストはトランザクションロールバックができない（アプリケーションレベルのテストのため）

**結果:**
- **非決定論的なテスト失敗**: 並行実行の順序によってパスしたり失敗したりする
- **デバッグ困難**: 単体実行では常に通るのに並行実行で失敗する

**予防策:**
1. **テストごとに独立したユーザーを作成**:
   ```typescript
   // テストごとに一意のメールアドレスでユーザー作成
   test.beforeEach(async ({ page }) => {
     const uniqueEmail = `test-${Date.now()}-${Math.random()}@test.example.com`;
     // Supabase Admin APIでユーザー作成
     const { data } = await adminSupabase.auth.admin.createUser({
       email: uniqueEmail,
       password: 'test-password',
     });
     // ポイントも初期化
     await adminSupabase.from('member_plans').insert({ ... });
   });
   ```

2. **テスト後に使用データをクリーンアップ**:
   ```typescript
   test.afterEach(async () => {
     // テストで作成したデータを削除
     await adminSupabase.from('bookings').delete().eq('created_by_test', true);
   });
   ```

3. **シリアル実行で安定させる（小規模プロジェクト向け）**:
   ```typescript
   // playwright.config.ts
   workers: 1, // 並行実行を無効化
   ```
   - テスト数が少ない（~30件程度）なら速度への影響は軽微

**検出サイン:**
- `--workers=1` オプションをつけると通るが、デフォルトだと失敗するテストがある
- エラーメッセージが「Expected 100 points, received 40 points」のように期待値と実際値がズレている

**どのフェーズで対応すべきか:**
- **E2E実装フェーズ**: playwright.config.ts 設定時に `workers: 1` から始める。スイートが安定したら並行実行を検討

---

## フェーズ別の警告（更新版）

| フェーズトピック | 最も可能性の高い落とし穴 | 緩和策 |
|-------------|---------------|------------|
| Phase 1 (DB設計) | ポイントトランザクション整合性の破綻 | `consume_points`関数に`FOR UPDATE NOWAIT`実装 |
| Phase 2 (予約API実装) | 分散トランザクションの補償処理欠如 | Sagaパターン設計 + 冪等性キー |
| Phase 3 (外部API統合) | OAuth トークン期限切れの未対応 | リフレッシュトークン自動更新実装 |
| Phase 3 (カレンダー同期) | Google Calendar API Rate Limiting | 排他制御 + バックオフ戦略 |
| Phase 3 (Zoom統合) | Zoom会議の孤立（削除漏れ） | キャンセルフロー補償トランザクション |
| Phase 4 (テスト) | トランザクション失敗カバレッジ不足 | 各ステップの失敗シナリオをモックでテスト |
| Phase 4 (テスト) | 二重予約の並行テスト未実施 | k6で100並行予約シミュレーション |
| Phase 5 (Cron実装) | Edge Function実行失敗の未検知 | ロギング + Slack通知 |
| Phase 5 (運用) | Vercel Serverless 10秒タイムアウト | 非同期処理分離 or Vercel Pro移行 |
| **E2E環境構築** | **Google OAuth の自動化不可** | **REST API経由でセッション作成、OAuthはスキップ** |
| **E2E環境構築** | **本番DBへのテストデータ汚染** | **Supabaseローカル環境 + 環境変数分岐** |
| **E2E認証実装** | **httpOnly Cookie と storageState の不一致** | **UI経由でCookieをセットしてから storageState を保存** |
| **E2E外部API** | **page.route() でサーバーサイドAPIをモックできない** | **環境変数フラグでAPIクライアントをスタブ化** |
| **E2E CI設定** | **Vercel Deployment Protection でテスト失敗** | **Protectionを無効化 or ローカルビルドで代替** |
| **E2E実装全般** | **Server Actions のハイドレーション競合** | **要素の状態変化を明示的に待つ、本番ビルドでテスト** |
| **E2E並行実行** | **共有ユーザーへの並行アクセスでDB競合** | **`workers: 1` から開始、テストごとにユーザー分離** |

---

## 提出前チェックリスト

- [x] 全ドメイン調査完了（トランザクション、ポイント整合性、外部API、並行制御、タイムゾーン）
- [x] 否定的主張を公式ドキュメントで検証（OAuth、Saga、RLS、Rate Limiting）
- [x] 重要な主張に複数ソース（WebSearch + 公式ドキュメント + CONCERNS.md）
- [x] 信頼度レベルを正直に割り当て（MEDIUM: WebSearch + 既存CONCERNS.md検証）
- [x] 権威ある情報源のURL提供
- [x] 公開日確認（2025-2026の情報を優先）
- [x] 「見落としている可能性」レビュー完了
- [x] E2Eテスト固有の落とし穴を追記 (2026-03-15)

---

## 情報源

**予約システム全般:**
- [17 Common Mistakes to Avoid While Using Online Booking Systems](https://ezbook.com/mistakes-to-avoid-when-using-online-booking-system/)
- [5 Common Online Booking Mistakes and How to Avoid Them](https://www.site123.com/learn/5-common-booking-mistakes-and-how-to-avoid-them)
- [How to Avoid Double‑Booking Appointments](https://acuityscheduling.com/learn/avoid-double-booking-appointments)

**並行制御・競合状態:**
- [How to Solve Race Conditions in a Booking System](https://hackernoon.com/how-to-solve-race-conditions-in-a-booking-system)
- [Concurrency Conundrum in Booking Systems](https://medium.com/@abhishekranjandev/concurrency-conundrum-in-booking-systems-2e53dc717e8c)
- [Building a Ticketing System: Concurrency, Locks, and Race Conditions](https://codefarm0.medium.com/building-a-ticketing-system-concurrency-locks-and-race-conditions-182e0932d962)

**分散トランザクション・Sagaパターン:**
- [Saga Design Pattern - Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga)
- [Mastering the Saga Pattern: Building Resilient Distributed Transactions in Microservices (February 2026)](https://medium.com/@cse.saiful2119/mastering-the-saga-pattern-building-resilient-distributed-transactions-in-microservices-566e51139d5d)
- [Microservices Pattern: Pattern: Saga](https://microservices.io/patterns/data/saga.html)

**OAuth・トークン管理:**
- [OAuth 2 Refresh Tokens: A Practical Guide](https://frontegg.com/blog/oauth-2-refresh-tokens)
- [Hardening OAuth Tokens in API Security: Token Expiry, Rotation, and Revocation Best Practices](https://www.clutchevents.co/resources/hardening-oauth-tokens-in-api-security-token-expiry-rotation-and-revocation-best-practices)
- [How to handle concurrency with OAuth token refreshes](https://nango.dev/blog/concurrency-with-oauth-token-refreshes)
- [Best Practices | Authorization Resources | Google for Developers](https://developers.google.com/identity/protocols/oauth2/resources/best-practices)

**冪等性・API設計:**
- [Mastering Idempotency: Building Reliable APIs](https://blog.bytebytego.com/p/mastering-idempotency-building-reliable)
- [Implementing Idempotency Keys in REST APIs](https://zuplo.com/learning-center/implementing-idempotency-keys-in-rest-apis-a-complete-guide)
- [Idempotent requests | Stripe API Reference](https://docs.stripe.com/api/idempotent_requests)

**PostgreSQLロック・デッドロック:**
- [PostgreSQL: Documentation: Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html)
- [Preventing Deadlocks and Securing PostgreSQL Procedures: A Comprehensive Guide](https://tech-champion.com/database/preventing-deadlocks-and-securing-postgresql-procedures-a-comprehensive-guide/)
- [Understanding PostgreSQL Row-Level Locking: A Practical Guide](https://opensource-db.com/understanding-postgresql-row-level-locking-a-practical-guide/)

**リトライ・通知システム:**
- [Building a Notification System That Never Loses a Message (2025)](https://aws.plainenglish.io/building-a-notification-system-that-never-loses-a-message-374314b7b92e)
- [How to Implement Retry Logic with SQS (February 2026)](https://oneuptime.com/blog/post/2026-02-02-sqs-retry-logic/view)
- [How to Handle Errors and Implement Retry Policies in Azure Logic Apps Workflows (February 2026)](https://oneuptime.com/blog/post/2026-02-16-how-to-handle-errors-and-implement-retry-policies-in-azure-logic-apps-workflows/view)

**タイムゾーン・キャンセルポリシー:**
- [How to Create an Effective Cancellation Policy in Coaching](https://simply.coach/blog/effective-cancellation-policy/)
- [5 Common Booking Mistakes and How to Avoid Them](https://www.blab.co/blog/5-common-booking-mistakes-and-how-to-avoid-them)

**Zoom・Googleカレンダー統合:**
- [Troubleshooting calendar integration issues with Zoom Scheduler](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0080966)
- [Issues with meetings and calendar integration](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0083813)

**サブスクリプション・ポイントシステム:**
- [Mastering Data Consistency Across Microservices](https://blog.bytebytego.com/p/mastering-data-consistency-across)
- [6 Best Subscription Management Software for SaaS in 2026](https://schematichq.com/blog/best-subscription-management-software)

**E2Eテスト (Playwright + Supabase Auth):**
- [How to test Google OAuth flow using Cypress - Supabase Discussion](https://github.com/orgs/supabase/discussions/9377)
- [Login at Supabase via REST API in Playwright E2E Test](https://mokkapps.de/blog/login-at-supabase-via-rest-api-in-playwright-e2e-test)
- [Testing with Next.js 15, Playwright, MSW, and Supabase](https://micheleong.com/blog/testing-with-nextjs-15-and-playwright-msw-and-supabase)
- [Testing Supabase Magic Login in CI with Playwright](https://www.bekapod.dev/articles/supabase-magic-login-testing-with-playwright/)

**E2Eテスト (Next.js App Router):**
- [Testing: Playwright | Next.js Official Docs](https://nextjs.org/docs/app/guides/testing/playwright)
- [Fetch Mocking With Playwright in Next.js 15](https://momentic.ai/blog/fetch-mocking-with-playwright-next-js)
- [Server Side Mocking for Playwright in NextJS (App Router) using MSW](https://dev.to/votemike/server-side-mocking-for-playwright-in-nextjs-app-router-using-mock-service-worker-2p4i)
- [End-to-End Testing Auth Flows with Playwright and Next.js](https://testdouble.com/insights/how-to-test-auth-flows-with-playwright-and-next-js)

**E2Eテスト (Vercel + GitHub Actions):**
- [How can I run end-to-end tests after my Vercel Preview Deployment?](https://vercel.com/kb/guide/how-can-i-run-end-to-end-tests-after-my-vercel-preview-deployment)
- [Playwright: Run E2E Tests against your Vercel Deployment using GitHub Actions](https://www.janpoth.de/en/blog/playwright-vercel-e2e-tests)
- [How to use Playwright with GitHub Actions for e2e testing of Vercel preview deployments](https://cushionapp.com/journal/how-to-use-playwright-with-github-actions-for-e2e-testing-of-vercel-preview)

**E2Eテスト (DB分離・Supabase):**
- [Testing Overview | Supabase Docs](https://supabase.com/docs/guides/local-development/testing/overview)
- [Reset the Supabase Database in Cypress](https://makerkit.dev/blog/tutorials/reset-supabase-database-tests)
- [GitHub - isaacharrisholt/supawright: A Playwright test harness for E2E testing with Supabase](https://github.com/isaacharrisholt/supawright)

**Playwrightのflaky防止:**
- [How to Detect and Avoid Playwright Flaky Tests in 2026](https://www.browserstack.com/guide/playwright-flaky-tests)
- [Why Your Playwright Tests Are Still Flaky (And It's Not Because of Timing)](https://medium.com/codetodeploy/why-your-playwright-tests-are-still-flaky-and-its-not-because-of-timing-9c005d0e83a3)

---

**調査完了: 2026-02-22 / E2Eテスト固有落とし穴追記: 2026-03-15**
**次のステップ:** これらの落とし穴を基に、ロードマップ作成時に各フェーズで対処すべきリスクを明確化する。
