# Feature Research

**Domain:** コーチングセッション予約管理システム — v1.3 運用改善機能
**Researched:** 2026-03-27
**Confidence:** HIGH

---

## 概要

v1.3で追加する4機能の期待される動作・複雑度・依存関係を整理する。
これらはいずれも「既存機能の運用品質を上げる」機能であり、新規のユーザーフローを作るわけではない。

---

## Feature Landscape

### Table Stakes (Users Expect These)

既存システムがある以上、これらが欠けると「壊れている」と感じられる機能。

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| プランタイプ別メニュー表示 | 会員予約画面で「自分のプランでは使えないメニュー」が表示されることはUX上の欠陥 | LOW | 現在 `zoom_account="B"` の固定フィルタで代替されているが、プラン概念とずれている |
| Zoomカレンダーのスロットブロック | 管理者がZoom上で直接ブロックした時間帯も予約不可になるのが当然 | MEDIUM | Zoom側のスケジュール済み会議をbusy時間として扱う暫定対応 |
| ポイント繰り越し上限の事前通知 | `plans.max_points` が設定されているプランでは、溢れる前に知らせることがユーザーへの誠実な対応 | MEDIUM | 既存の月次バッチ基盤 (Edge Function + pg_cron) を再利用できる |
| 会員アクティビティの可視化 | 管理者が「最近来ていない会員」を一目で確認できることは、サービス品質維持に必須 | LOW | 既存の会員一覧画面に色分けバッジを追加する形 |

### Differentiators (Competitive Advantage)

このサービス独自の価値提供になりうる機能。

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| プランタイプ別メニュー制御 (管理UI) | 管理者がメニューとプランの対応を柔軟に設定できる (例: Premiumプランのみ90分セッション可) | MEDIUM | DBスキーマ変更 (中間テーブル) が必要。見た目のシンプルさを維持しながら設定の柔軟性を担保することが差別化 |
| ポイント溢れ通知メール | 月次ポイント付与前に「XX pt 溢れます、ご利用ください」という先手の通知はTimeRex等にはない独自機能 | MEDIUM | 毎月20日バッチ。Resend + React Email テンプレート追加 |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| リアルタイムZoom空き同期 | 「常に最新のZoom状況を反映したい」 | Zoom APIポーリングのクォータ超過リスク。Server-to-Server OAuthでrate limitは5req/秒。キャッシュなしだと一度のスロット取得で複数API呼び出しが発生 | 既存の `getCachedBusyTimes()` パターンを流用し、Zoom busy times に15分キャッシュを適用 |
| Zoom上の会議をプラットフォームで全管理 | 「Zoom画面を見なくて済むように」 | Zoom APIは `GET /users/me/meetings?type=scheduled` でリスト取得できるが、他システム（Zoom Schedulerなど）から作成された会議を消したり変更する権限は適切でない | 読み取り専用でbusy時間として参照するにとどめる |
| プランに応じた予約上限数制限 | 「高いプランほど多く予約できるようにしたい」 | 現在のDBスキーマにそのような制約がない。追加すると予約フローのSagaパターンに新ステップが増え複雑化 | v1.3スコープ外。ポイント制がすでに自然な予約上限として機能している |
| 30日/60日未訪問アラートのメール通知 | 「管理者が手動で確認する必要がある」 | 管理者向け通知メールを送ることはResend月3,000通の枠を圧迫し、ROIが低い | ダッシュボードのUI表示にとどめる。「色分けで見れば十分」な規模感 (現在約10人) |

---

## Feature Details

### 機能1: プランタイプ別メニュー表示 (#10)

**期待される動作:**
- 管理者がメニューを作成・編集する際、「表示対象プラン」を選択できる
- 会員がメニュー選択画面にアクセスした際、自分のプランで利用可能なメニューのみが表示される
- ゲスト（`zoom_account="B"` のカジュアルセッション）には影響しない

**現状分析:**
- 現在、会員予約画面は `zoom_account="B"` でハードコードされたフィルタを使用（`bookings/new/page.tsx` L53-58）
- `plans` テーブルと `meeting_menus` テーブルの間に関連を持つ中間テーブルが存在しない
- `meeting_menus` に `plan_type` カラムを追加するか、中間テーブル `plan_menus` を作るかの設計判断が必要

**DBスキーマ変更の選択肢:**

| アプローチ | 設計 | メリット | デメリット |
|-----------|------|---------|-----------|
| カラム追加 | `meeting_menus.allowed_plan_ids integer[]` | シンプル | PostgreSQL配列の取り扱いが若干煩雑 |
| 中間テーブル | `plan_menus(plan_id, menu_id)` | 正規化・拡張性が高い | マイグレーション + JOIN追加のコスト |

**推奨:** 中間テーブル `plan_menus` (将来の多対多関係に対応可能。現在でも1メニューが複数プランで使えるケースを想定する必要がある)

**実装ポイント:**
- 中間テーブルが空（全プラン未設定）の場合のデフォルト動作を決める（全プランに表示 or 誰にも表示しない）
- 管理者UIのメニュー作成/編集フォームにプラン選択UIを追加
- 会員予約API/クエリでJOINするか、プランIDでフィルタするかの最適化

**複雑度:** MEDIUM（DBスキーマ変更 + Admin UI + 予約フィルタロジック）

---

### 機能2: Zoomカレンダースケジュールブロック (#12)

**期待される動作:**
- Zoom A/B アカウントで「スケジュール済み（scheduled）」の会議時間も、空きスロット計算時のbusy時間として扱われる
- 具体的には、`GET /users/me/meetings?type=scheduled` でZoom上のスケジュール済み会議リストを取得し、各会議の `start_time` + `duration` をbusy時間として変換する
- Google Calendarのbusy times (`getCachedBusyTimes`) と同様の15分キャッシュを適用する

**Zoom API確認済みの仕様:**
- `GET /users/me/meetings?type=scheduled` — スケジュール済み会議リスト取得（HIGH confidence: 公式ドキュメント確認済み）
- レスポンスには `start_time`（ISO 8601形式）と `duration`（分単位）が含まれる
- Server-to-Server OAuthで取得したトークンで呼び出し可能（既存の `getZoomAccessToken()` を再利用可能）
- **制約:** 日付範囲でのフィルタリングはできない。全スケジュール済み会議を取得してクライアント側で日付範囲フィルタが必要

**実装ポイント:**
- 既存の `zoom.ts` に `getZoomScheduledMeetings(accountType)` 関数を追加
- A・Bアカウント両方を取得して統合
- `busy_times[]` 形式（`{ start: string, end: string }`）に変換して既存の空きスロット計算と合流
- 15分キャッシュ（LRUCache）を適用してAPI呼び出しを削減
- このシステムで作成した予約のZoom会議は重複してブロックされるため、除外ロジックが必要（bookings テーブルとの突き合わせ or Zoom meeting IDで除外）

**複雑度:** MEDIUM（Zoom API追加 + キャッシュ + 既存スロット計算との統合）

**「暫定対応」と注記されている理由:**
- 完全な解決策はZoom CalendarのFreeBusy APIを使うことだが、スコープ設定や権限が異なる可能性がある
- `type=scheduled` での取得はシステム外から作成されたZoom会議（他システムからのスケジュール等）を全て拾う

---

### 機能3: ポイント溢れ通知メール (#9)

**期待される動作:**
- 毎月20日のバッチ処理で、翌月1日のポイント付与後に `max_points` を超過する予定の会員を特定
- 対象会員に「XX ポイント溢れます。今月中にご利用ください」という内容のメールを送信
- ポイントに繰り越し上限がないプラン（`plans.max_points IS NULL`）の会員は対象外

**既存インフラとの関係:**
- `monthly-point-grant` Edge Functionと同様のパターンで `point-overflow-notify` Edge Functionを追加
- pg_cronで「毎月20日に実行」のスケジュール設定
- Resend + React Email テンプレート追加（既存の `sendWelcomeEmail` 等と同じパターン）

**溢れ量の計算:**
```sql
SELECT
  mp.user_id,
  p.email,
  p.full_name,
  mp.current_points,
  mp.monthly_points,
  pl.max_points,
  (mp.current_points + mp.monthly_points) - pl.max_points AS overflow_points
FROM member_plans mp
JOIN profiles p ON mp.user_id = p.id
JOIN plans pl ON mp.plan_id = pl.id
WHERE mp.status = 'active'
  AND pl.max_points IS NOT NULL
  AND (mp.current_points + mp.monthly_points) > pl.max_points
```

**実装ポイント:**
- Edge Function: 冪等性チェック（今月20日分の通知が既に送信済みか確認）
- メールテンプレート: `PointOverflowNotification` コンポーネント
- `task_execution_logs` への記録（既存パターンと統一）
- テスト考慮: Resend がモックできる環境での動作確認

**複雑度:** MEDIUM（Edge Function追加 + pg_cron設定 + Emailテンプレート追加）

---

### 機能4: 会員アクティビティ表示 (#8)

**期待される動作:**
- 管理者の会員一覧画面（`/admin/members`）で、最終予約日から30日/60日以上経過した会員に色付きバッジを表示
  - 30〜59日未訪問: 黄色バッジ「30日未訪問」
  - 60日以上未訪問: 赤バッジ「60日未訪問」
  - 予約履歴なし: 赤バッジ「未利用」
- ダッシュボード（`/admin/dashboard`）に「要フォロー会員リスト」セクションを追加（30日以上未訪問の会員を列挙）

**最終予約日の計算:**
```sql
SELECT
  mp.user_id,
  MAX(b.start_time) AS last_booking_at
FROM member_plans mp
LEFT JOIN bookings b ON mp.id = b.member_plan_id
  AND b.status != 'canceled'
WHERE mp.status = 'active'
GROUP BY mp.user_id
```

**実装ポイント:**
- `getMembers()` のクエリを拡張して `last_booking_at` を含める
- フロントエンド側（`columns.tsx`）で現在日時との差分を計算してバッジをレンダリング
- Tailwind で `30日未訪問=yellow`、`60日以上=red` の色を適用
- ダッシュボードには既存コンポーネントの構造を踏襲してリスト表示を追加

**複雑度:** LOW（SQLクエリ拡張 + フロントエンドバッジ表示）

---

## Feature Dependencies

```
[プランタイプ別メニュー表示]
    └── requires ──> [DBスキーマ変更 (plan_menus 中間テーブル)]
                        └── requires ──> [管理者UI: メニュー作成フォームのプラン選択追加]
    └── requires ──> [会員予約クエリのフィルタロジック変更]

[Zoomカレンダーブロック]
    └── requires ──> [既存 zoom.ts の getZoomAccessToken()]
    └── enhances ──> [既存 getCachedBusyTimes() パターン]
    └── depends ──> [空きスロット計算ロジック (SlotPicker)]

[ポイント溢れ通知メール]
    └── requires ──> [既存 monthly-point-grant Edge Function パターン]
    └── requires ──> [新規 React Email テンプレート]
    └── requires ──> [pg_cron 新スケジュール登録]
    └── depends ──> [plans.max_points が設定されている前提]

[会員アクティビティ表示]
    └── enhances ──> [既存 getMembers() アクション]
    └── enhances ──> [既存 /admin/members columns.tsx]
    └── enhances ──> [既存 /admin/dashboard ページ]
```

### Dependency Notes

- **プランタイプ別メニュー**: 中間テーブル追加のマイグレーションが先行必須。その後に管理UI変更と予約フィルタ変更を並行できる
- **Zoomカレンダーブロック**: 独立して実装可能。空きスロット計算の最終ステップで統合する
- **ポイント溢れ通知**: `plans.max_points` の値を持つプランが存在することが前提。現状は `max_points` がNULLのプランも存在しうる
- **会員アクティビティ**: 完全に独立。他3機能への依存なし。最もリスクが低い

---

## MVP Definition

### Launch With (v1.3) — 全4機能が今回のスコープ

- [x] **プランタイプ別メニュー表示** — 予約体験の根幹。「使えないメニューが見える」のはUX上の問題
- [x] **Zoomカレンダーブロック** — Zoom直接ブロックと予約システムの矛盾は運用上の混乱を招く
- [x] **ポイント溢れ通知メール** — `max_points` が設定されたプランがある場合の誠実な対応
- [x] **会員アクティビティ表示** — 管理者の「感覚的な把握」をデータで補完する

### Add After Validation (v1.4+)

- [ ] **プランタイプ別メニューの動的切り替え** — プラン変更時にメニュー再フィルタ（現在は会員登録時固定）
- [ ] **アクティビティ表示の詳細化** — 最終予約内容（どのメニューを使ったか）を合わせて表示
- [ ] **ポイント溢れ通知の個別カスタマイズ** — 通知のN日前設定など

### Future Consideration (v2+)

- [ ] **Zoom FreeBusy APIへの移行** — `type=scheduled` での暫定取得から正式なFreeBusy APIへ
- [ ] **LINE通知対応** — メール以外のチャンネル（Out of Scope扱い、要求が出たら検討）
- [ ] **会員向けポイント残高アラート** — 会員自身が「溢れそうです」通知を受け取る機能

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| プランタイプ別メニュー表示 | HIGH | MEDIUM | P1 |
| Zoomカレンダーブロック | HIGH | MEDIUM | P1 |
| ポイント溢れ通知メール | MEDIUM | MEDIUM | P2 |
| 会員アクティビティ表示 | MEDIUM | LOW | P1 |

**優先度キー:**
- P1: v1.3でリリース（全4機能が対象）
- P2: P1の後にリリース、または同一マイルストーン内の後半フェーズ

**実装推奨順序:**
1. 会員アクティビティ表示（LOW complexity、独立、即リリース可）
2. Zoomカレンダーブロック（MEDIUM complexity、独立）
3. プランタイプ別メニュー表示（MEDIUM complexity、DBスキーマ変更あり）
4. ポイント溢れ通知メール（MEDIUM complexity、新Edge Function + テンプレート）

---

## Sources

- Zoom Meetings API公式ドキュメント — `GET /users/me/meetings?type=scheduled` の動作確認（HIGH confidence）
  - https://developers.zoom.us/docs/api/meetings/
- Zoom Developer Forum — 日付範囲フィルタ非対応の確認（HIGH confidence）
  - https://devforum.zoom.us/t/how-to-find-all-upcoming-meetings-on-a-given-date/26995
- 既存コードベース調査（HIGH confidence）:
  - `src/lib/integrations/zoom.ts` — Server-to-Server OAuth実装、LRUキャッシュパターン
  - `src/lib/integrations/google-calendar.ts` — getCachedBusyTimes() パターン（Zoomにも流用可能）
  - `supabase/functions/monthly-point-grant/index.ts` — Edge Function + 冪等性チェックパターン
  - `supabase/migrations/20260222000003_stored_procedures.sql` — grant_monthly_points() の max_points 上限ロジック
  - `src/app/(member)/bookings/new/page.tsx` — 現在の zoom_account="B" ハードコードフィルタ（改修対象）
  - `src/app/admin/members/columns.tsx` — アクティビティバッジ追加対象

---
*v1.3 運用改善マイルストーン向けフィーチャーリサーチ*
*調査日: 2026-03-27*
