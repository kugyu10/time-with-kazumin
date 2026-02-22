# 機能調査: コーチングセッション予約システム

**ドメイン:** コーチング・コンサルティング予約管理
**調査日:** 2026-02-22
**信頼度:** MEDIUM

## 機能の全体像

### テーブルステークス（ユーザーの期待機能）

ユーザーが当然存在すると仮定する機能。欠けているとプロダクトが不完全に感じられる。

| 機能 | なぜ期待されるか | 複雑度 | 備考 |
|---------|--------------|------------|-------|
| カレンダー同期 | 全スケジューリングツールで標準。リアルタイム更新とダブルブッキング防止が期待される | MEDIUM | GoogleカレンダーAPIとの双方向同期。15分キャッシュでオンデマンド方式 |
| 自動リマインダー | 78%のユーザーが重要視。ノーショー防止の第一手段 | LOW | メール/SMS送信。予約24-48時間前が効果的（ノーショー率40%削減） |
| オンライン予約 | 77%が重要視。セルフサービス予約は現代の必須条件 | LOW | 会員/ゲスト両方対応。24/7利用可能 |
| 予約確認通知 | ユーザーとサービス提供者双方への自動確認メールは業界標準 | LOW | 予約時・キャンセル時の自動メール送信 |
| 簡単なキャンセル・再予約 | セルフサービスでの変更可能性がノーショー防止につながる | MEDIUM | ポイント返還ロジックとの統合が必要 |
| モバイル対応 | モバイル最適化の欠如は機会損失に直結 | LOW | レスポンシブデザインで対応 |
| タイムゾーン対応 | グローバル対応やリモートセッションでは必須 | LOW | ブラウザ自動検出で対応 |
| ビデオ会議統合 | コーチングは2026年時点でほぼ全てオンライン。Zoom/Google Meet等の自動リンク生成が標準 | MEDIUM | Zoom API連携。アカウント使い分けロジックが追加要件 |
| 決済統合 | 73%が高重要度と評価。予約時決済でノーショー率80%削減 | HIGH | MVP外だが将来必須（Stripe/PayPal統合） |
| クライアントデータベース | 63%が重要視。予約履歴とクライアント情報の管理は基本機能 | LOW | Supabase DBで対応済み |

### 差別化要素（競争優位性）

標準機能ではないが、価値を提供する機能。

| 機能 | 価値提案 | 複雑度 | 備考 |
|---------|-------------------|------------|-------|
| ポイント制サブスクリプション | 一般的な予約システムは単発予約が中心。ポイント制は顧客ロイヤルティと柔軟な利用を両立 | HIGH | 市場では珍しい実装（SuperSaaS等一部のみ）。毎月自動付与+手動調整が差別化 |
| パーソナライズされた温かいUX | 「堅苦しいビジネス予約」ではなく「友だちに声をかける」感覚。ブランドカラー・トーンでの差別化 | MEDIUM | デザイン・コピーライティングが重要。機能ではなく体験の差別化 |
| Zoomアカウント使い分け | カジュアルセッション（40分制限）と有料セッション（無制限）で自動切り替え | MEDIUM | 独自の運用要件。一般ツールには存在しない |
| カジュアル無料体験枠 | 会員登録なしでの30分体験。リード獲得とコンバージョン導線の最適化 | LOW | 会員化への明確なファネル構造 |
| セッション後サンキューメール | 予約終了30分後の自動送信。フォローアップとリテンション向上 | LOW | ON/OFF可。パーソナライゼーションの一環 |
| 祝日対応営業時間 | 曜日別+祝日パターンで柔軟な空き時間設定 | MEDIUM | Google公開カレンダー連携。多くのツールは曜日のみ |
| ミーティングバッファ設定 | セッション前後の余裕時間を確保。コーチの負荷軽減 | MEDIUM | 前後バッファを個別設定可能。UX配慮の表れ |
| パッケージ/サブスク管理 | Acuityが強みとする領域。ポイント制はこれをさらに柔軟にした形 | HIGH | 既存実装でカバー |
| 管理者招待制会員登録 | 一般のセルフ登録ではなく、招待ベースで会員品質を管理 | LOW | クローズドコミュニティ的運用 |

### アンチフィーチャー（要望されるが問題になりやすい機能）

一見良さそうだが、実際には問題を引き起こす機能。

| 機能 | なぜ要望されるか | なぜ問題か | 代替案 |
|---------|---------------|-----------------|-------------|
| リアルタイム全自動カレンダー同期 | 「常に最新」への期待 | API制限とコストが急増。現規模では過剰。15分キャッシュで実用上問題なし | オンデマンド同期（15分キャッシュ）で十分。100人超でcronバッチ検討 |
| リッチテキストメールエディタUI | 管理画面での柔軟な編集 | 実装コスト高。MVP初期はテンプレート変更頻度低い。WYSIWYG品質問題 | React Emailでコードベース管理。変更頻度増加時に再検討 |
| ユーザーカレンダーへの自動書き込み | 手動登録の手間削減 | OAuth審査・write権限要求でMVP遅延。全ユーザー対応の複雑性 | 1クリックURLスキーム方式（Google Calendar/iCal/Outlook対応）で摩擦最小化 |
| 複数コーチ対応 | 将来の拡張性 | 全テーブルにcoach_id追加で設計複雑化。現状1人運用で不要 | シングルコーチで設計。需要発生時に大規模リファクタ |
| Zoomアカウント動的管理UI | 柔軟な設定変更 | 2アカウント固定のため動的UIは過剰。YAGNI原則違反 | 環境変数で管理。3アカウント以上で再検討 |
| 詳細キャンセルポリシー（時間制限） | ビジネスルール適用 | MVP初期は信頼関係ベース。実装の割に使用頻度低い | 全額返還で開始。悪用発生時に時間制限追加 |
| LINE通知 | 日本市場での利便性 | LINE Messaging API連携・OAuth・メッセージング設計が複雑。メールで代替可 | まずメール通知で検証。要望増加でLINE追加 |
| 無制限カスタマイズ可能なメニュー項目 | 柔軟性の追求 | UI複雑化・バリデーション増加。現状5-6メニューで十分 | 時間・ポイント・Zoomアカウントの組み合わせに限定。シンプルCRUD |

## 機能の依存関係

```
[オンライン予約] (コア機能)
    ├──requires──> [カレンダー同期] (空き時間算出)
    │                   └──requires──> [営業時間設定] (基本営業枠)
    │                   └──requires──> [祝日判定] (営業時間上書き)
    │                   └──requires──> [ミーティングバッファ] (空き時間調整)
    ├──requires──> [ビデオ会議統合] (Zoomリンク生成)
    │                   └──requires──> [Zoomアカウント使い分けロジック]
    └──requires──> [ポイント管理] (会員予約時)
                        └──requires──> [サブスクプラン管理]

[自動リマインダー]
    └──requires──> [予約データ] (送信対象の特定)

[キャンセル・再予約]
    ├──requires──> [ポイント返還ロジック] (会員の場合)
    ├──requires──> [Zoom会議削除] (リソース解放)
    └──requires──> [カレンダー同期] (空き枠再計算)

[管理者ポイント手動調整]
    └──enhances──> [ポイント管理] (例外対応)

[セッション後サンキューメール]
    └──enhances──> [自動リマインダー] (顧客体験向上)

[カジュアル無料体験]
    └──conflicts──> [ポイント制限] (0pt特別扱い)
```

### 依存関係の補足

- **[オンライン予約] requires [カレンダー同期]:** 空き時間の算出にはGoogleカレンダーのbusy時間除外が必須。営業時間設定・祝日判定・ミーティングバッファと組み合わせて最終的な空きスロットを生成
- **[オンライン予約] requires [ビデオ会議統合]:** 予約確定時にZoom会議URLを自動生成。メニューに応じたZoomアカウント（A/B）の使い分けロジックが必要
- **[オンライン予約] requires [ポイント管理]:** 会員予約時にはポイント残高チェックと消費処理が必須。サブスクプラン管理と連携
- **[キャンセル・再予約] requires [ポイント返還ロジック]:** キャンセル時は消費ポイントを全額返還。トランザクション整合性が重要
- **[管理者ポイント手動調整] enhances [ポイント管理]:** 例外対応（ボーナス付与、調整）のための補完機能
- **[セッション後サンキューメール] enhances [自動リマインダー]:** リマインダーがプッシュ型なら、サンキューメールはプル型のリテンション施策
- **[カジュアル無料体験] conflicts with [ポイント制限]:** 0ptの特別扱いが必要。ゲストは会員のポイント管理フローをバイパス

## MVP定義

### ローンチ時に含めるもの（v1）

最小限の価値検証に必要な機能。

- [x] オンライン予約（ゲスト・会員） — コア価値提供。これがないとサービスが成立しない
- [x] カレンダー同期（Googleカレンダー） — 空き時間算出の基盤。ダブルブッキング防止
- [x] 営業時間設定（曜日別+祝日） — 空き時間の基本枠定義
- [x] ミーティングバッファ設定 — コーチの負荷軽減。UX差別化の一環
- [x] ポイント制サブスクリプション — 差別化の中核機能。月次自動付与+手動調整
- [x] ビデオ会議統合（Zoom自動生成） — オンラインコーチングの必須要件
- [x] Zoomアカウント使い分け — 独自運用要件。カジュアル/有料セッション区別
- [x] 自動リマインダー（メール） — ノーショー防止の第一手段
- [x] 予約確認・キャンセル通知 — 業界標準の自動通知
- [x] キャンセル・ポイント返還 — ユーザーの柔軟性とポイント制の整合性
- [x] カジュアル無料体験枠 — リード獲得とコンバージョンファネル
- [x] 管理者会員招待・登録 — クローズドコミュニティ運用
- [x] 管理者ポイント手動調整 — 例外対応の柔軟性
- [x] メニュー・プランCRUD管理 — 運用の柔軟性確保
- [x] 1クリックカレンダー登録（URLスキーム） — OAuth審査回避しつつUX確保

### 検証後に追加（v1.x）

コアが動作確認できてから追加する機能。

- [ ] 決済統合（Stripe） — ノーショー率削減（80%効果）とサブスク自動化。会員10-20人到達時
- [ ] セッション後サンキューメール — リテンション向上。テンプレート確定後
- [ ] SMS リマインダー — メール開封率低下時の補完手段。ノーショー率改善が必要になった時点
- [ ] 詳細キャンセルポリシー（時間制限） — 悪用・ノーショーが頻発した場合
- [ ] クライアントポータル（セッション履歴閲覧） — 会員が自身の履歴を確認したいニーズが明確になった時点
- [ ] 予約分析・レポート機能 — 運用データが蓄積され、改善施策が必要になった時点

### 将来検討（v2+）

プロダクト・マーケット・フィットが確立されてから検討する機能。

- [ ] LINE通知 — メール以外のチャネル要望が強まった場合。通知チャネル抽象化が前提
- [ ] メールテンプレートUI編集 — テンプレート変更頻度が上がり、コードベース管理が非効率になった時点
- [ ] 複数コーチ対応 — 2人目のコーチ参画が具体化した場合。全テーブル設計変更が必要
- [ ] クライアントセルフ登録 — 会員獲得チャネルが広がり、招待制が限界になった時点
- [ ] リアルタイムカレンダー同期 — 規模拡大（100人超）でバッチ処理が必要になった場合
- [ ] グループセッション機能 — 1対多セッション需要が発生した場合
- [ ] ウェイティングリスト — 人気枠でキャンセル待ち需要が発生した場合
- [ ] レビュー・フィードバック機能 — セッション品質管理の必要性が高まった時点

## 機能優先度マトリクス

| 機能 | ユーザー価値 | 実装コスト | 優先度 |
|---------|------------|---------------------|----------|
| オンライン予約 | HIGH | MEDIUM | P1 |
| カレンダー同期 | HIGH | MEDIUM | P1 |
| ポイント制サブスク | HIGH | HIGH | P1 |
| 自動リマインダー | HIGH | LOW | P1 |
| ビデオ会議統合 | HIGH | MEDIUM | P1 |
| Zoomアカウント使い分け | HIGH | MEDIUM | P1 |
| キャンセル・返還 | HIGH | MEDIUM | P1 |
| カジュアル無料体験 | HIGH | LOW | P1 |
| 営業時間設定（祝日対応） | MEDIUM | MEDIUM | P1 |
| ミーティングバッファ | MEDIUM | MEDIUM | P1 |
| 1クリックカレンダー登録 | MEDIUM | LOW | P1 |
| 管理者会員招待 | MEDIUM | LOW | P1 |
| メニュー・プランCRUD | MEDIUM | LOW | P1 |
| 決済統合 | HIGH | HIGH | P2 |
| サンキューメール | MEDIUM | LOW | P2 |
| SMSリマインダー | MEDIUM | MEDIUM | P2 |
| 詳細キャンセルポリシー | MEDIUM | MEDIUM | P2 |
| クライアントポータル | MEDIUM | MEDIUM | P2 |
| 分析・レポート | MEDIUM | MEDIUM | P2 |
| LINE通知 | MEDIUM | HIGH | P3 |
| メールテンプレートUI | LOW | HIGH | P3 |
| 複数コーチ対応 | LOW | HIGH | P3 |
| セルフ会員登録 | LOW | MEDIUM | P3 |
| リアルタイム同期 | LOW | HIGH | P3 |
| グループセッション | LOW | HIGH | P3 |
| ウェイティングリスト | LOW | MEDIUM | P3 |
| レビュー機能 | LOW | MEDIUM | P3 |

**優先度の定義:**
- P1: ローンチに必須。欠けるとサービスが成立しない
- P2: 早期追加が望ましい。検証後すぐに追加検討
- P3: 将来検討。需要が明確になってから実装

## 競合機能分析

| 機能 | Calendly | Acuity Scheduling | SimplyBook.me | 本プロジェクト |
|---------|--------------|--------------|--------------|--------------|
| オンライン予約 | ○（無制限1on1） | ○ | ○ | ○ |
| カレンダー同期 | ○（Google/Outlook） | ○ | ○ | ○（Google） |
| 自動リマインダー | ○（有料プラン） | ○ | ○ | ○（全プラン） |
| 決済統合 | ○（Stripe/PayPal） | ○（Square含む） | ○ | 将来対応 |
| ビデオ会議統合 | ○（自動生成） | △（手動設定） | ○ | ○（Zoom自動） |
| ポイント制サブスク | × | △（パッケージ販売） | ○（クレジットシステム） | ○（独自実装） |
| Zoomアカウント使い分け | × | × | × | ○（差別化） |
| カジュアル無料体験 | ○（無料プラン） | × | △ | ○（専用枠） |
| パーソナライズUX | △（ブランディング可） | ○（カスタマイズ豊富） | ○ | ○（差別化軸） |
| 祝日対応営業時間 | × | × | △ | ○（独自） |
| ミーティングバッファ | ○ | ○ | ○ | ○ |
| クライアント管理 | △（基本のみ） | ○（詳細） | ○ | ○（セッション履歴） |
| グループセッション | ○（有料プラン） | ○ | ○ | 将来検討 |
| 価格 | 無料〜$20/月 | $16〜/月 | 無料〜 | 自社開発 |

**競合との差別化ポイント:**
1. **ポイント制サブスク:** CalendlyやAcuityは単発予約・パッケージ販売が中心。ポイント制は柔軟性と継続性を両立
2. **Zoomアカウント使い分け:** カジュアル（40分制限）と有料（無制限）の自動切り替えは独自機能
3. **パーソナライズされた温かいUX:** 「友だちに声をかける」感覚のブランド体験。機械的な予約ツールとの差別化
4. **祝日対応営業時間:** 日本市場向けの細かい配慮。Googleカレンダー連携で実現

## 情報源

### コーチング予約システム機能
- [Online Scheduling App for Coaching | SimplyBook.me](https://simplybook.me/en/scheduling-app-for-personal-meetings/scheduling-app-for-coaching)
- [Best Coaching Software 2026 | Capterra](https://www.capterra.com/coaching-software/)
- [Coaching Scheduling Software: Automate Bookings | Delenta](https://www.delenta.com/coaching-scheduling)
- [The #1 Online Scheduling Software for Coaches | YouCanBookMe](https://youcanbook.me/scheduling-software-for-coaches)

### 予約システム標準機能
- [12 Best Scheduling Apps – Your Ultimate Buying Guide For 2026](https://youcanbook.me/blog/best-scheduling-apps)
- [15 Best Appointment Scheduling Software for 2026 | Research.com](https://research.com/software/best-appointment-scheduling-software)
- [Top Scheduling Software Features You Need in 2026 - Zeeg](https://zeeg.me/en/blog/post/appointment-scheduling-software-features)
- [Appointment Scheduling Software: 6 Must-Have Tools for 2026](https://www.bigcontacts.com/blog/best-appointment-scheduling-softwares/)

### 競合比較
- [Calendly vs Acuity for Coaches – Comparison [2025] | Life Coach Magazine](https://www.lifecoachmagazine.com/calendly-vs-acuity-for-coaches/)
- [Calendly vs. Acuity: Which is best? | Zapier](https://zapier.com/blog/calendly-vs-acuity/)
- [Calendly vs. Acuity Scheduling - Acuity Scheduling](https://acuityscheduling.com/compare/acuity-vs-calendly)

### ポイント制・クレジットシステム
- [The membership feature is extensive and very flexible - SimplyBook.me](https://simplybook.me/en/membership-solution)
- [SuperSaaS: Free Appointment Scheduling Software](https://www.supersaas.com/)

### ノーショー防止
- [25+ Ways: How to Reduce No Show Appointments (Ultimate Guide)](https://curogram.com/blog/how-to-reduce-no-show-appointments)
- [How to Reduce No-Show Appointments: 10 Practical Strategies](https://youcanbook.me/blog/how-to-reduce-no-show-appointments)
- [7 Proven Strategies to Reduce No-shows in Small Businesses](https://www.booknetic.com/blog/strategies-to-reduce-no-shows)

### クライアントポータル
- [Best Appointment Scheduling Software with Client Portal 2026 | GetApp](https://www.getapp.com/customer-management-software/appointments-scheduling/f/client-portal/)
- [Online Booking Using the Client Portal - Sessions Health Help Center](https://support.sessionshealth.com/article/29-online-booking-using-the-client-portal)

### パーソナライゼーション・UX
- [How to Keep Appointment Scheduling & Automation Personal](https://bookedin.com/blog/personalize-appointment-scheduling/)
- [Booking an appointment. The case study features the UX design… | Medium](https://medium.com/@alenatsytovich/booking-an-appointment-6714c409540)

### よくある失敗・落とし穴
- [The 6 most common mistakes when implementing an appointment booking system in 2026 and how to avoid them](https://www.tucalendi.com/en/blog/the-6-most-common-mistakes-when-implementing-an-appointment-booking-system-in-2026-and-how-to-avoid-them-507)
- [5 Common Online Booking Mistakes and How to Avoid Them](https://www.site123.com/learn/5-common-online-booking-mistakes-and-how-to-avoid-them)
- [How to avoid appointment scheduling mistakes | Waitwhile](https://waitwhile.com/blog/how-to-avoid-appointment-scheduling-mistakes/)
- [How to Solve Common Appointment Scheduling Mistakes - Acuity Scheduling](https://acuityscheduling.com/learn/appointment-scheduling-mistakes)

---
*コーチングセッション予約システムの機能調査*
*調査日: 2026-02-22*
