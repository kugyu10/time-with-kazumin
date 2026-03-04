---
phase: quick
plan: 3
type: execute
wave: 1
depends_on: []
files_modified:
  - .env.local
  - .env.prod
autonomous: false
requirements: [EMAIL-ENABLE]

must_haves:
  truths:
    - "メール送信が有効化されている"
    - "予約確認・キャンセルメールが実際に送信される"
  artifacts:
    - path: ".env.local"
      provides: "メール送信用環境変数（本番ドメイン）"
      contains: "FROM_EMAIL=.*@[^gmail|yahoo|hotmail|outlook|icloud]"
  key_links:
    - from: ".env.local"
      to: "src/lib/integrations/email.ts"
      via: "環境変数参照"
---

<objective>
メール送信機能を有効化する

**背景:**
現在、メール送信は以下の理由で無効化されている:
- `FROM_EMAIL=kugyu10@gmail.com` が設定されている
- `src/lib/integrations/email.ts`の`isEmailConfigured()`がgmail.comをpublicDomainsとしてブロック
- Resendはgmail.com等のパブリックドメインからの送信を許可していない

**解決策:**
Resendでカスタムドメインを設定し、FROM_EMAILをそのドメインのアドレスに変更する

Purpose: 予約確認・キャンセル・リマインダーメールの実際の送信を有効化
Output: メール送信が機能する環境設定
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@src/lib/integrations/email.ts
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Resendでカスタムドメインを設定</name>
  <action>
ユーザーがResendダッシュボードでカスタムドメインを設定する必要があります。

**手順:**
1. https://resend.com/domains にアクセス
2. 「Add Domain」をクリック
3. 所有しているドメイン名を入力（例: kazumin.jp, time-with-kazumin.com など）
4. DNSレコードを追加:
   - Resendが表示するMXレコード、TXTレコード、CNAMEレコードをDNSプロバイダに追加
   - SPF: TXT `v=spf1 include:_spf.resend.com ~all`
   - DKIM: CNAME（Resendが提供する値）
5. Resendで「Verify」をクリックしてDNS設定を確認
6. 検証完了を待つ（通常数分〜数時間）

**必要な情報（完了後に教えてください）:**
- 設定したドメイン名
- 使用したいFROM_EMAILアドレス（例: noreply@kazumin.jp）
  </action>
  <verify>Resendダッシュボードでドメインが「Verified」ステータスになっている</verify>
  <done>カスタムドメインがResendで検証完了</done>
  <resume-signal>設定したドメインと使用するFROM_EMAILアドレスを教えてください（例: "kazumin.jp, noreply@kazumin.jp"）</resume-signal>
</task>

<task type="auto">
  <name>Task 2: 環境変数を更新</name>
  <files>.env.local, .env.prod</files>
  <action>
Task 1でユーザーが提供したFROM_EMAILアドレスで環境変数を更新:

1. `.env.local`のFROM_EMAILを新しいアドレスに変更
2. `.env.prod`のFROM_EMAILを新しいアドレスに変更
3. 必要に応じてADMIN_EMAILも設定（管理者通知用）

変更前:
```
FROM_EMAIL=kugyu10@gmail.com
```

変更後:
```
FROM_EMAIL={ユーザー指定のアドレス}
ADMIN_EMAIL={管理者通知用アドレス}  # 任意
```
  </action>
  <verify>grep "FROM_EMAIL" .env.local で新しいドメインのアドレスが表示される</verify>
  <done>FROM_EMAILがカスタムドメインのアドレスに更新されている</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: メール送信テスト</name>
  <what-built>メール送信機能の有効化</what-built>
  <how-to-verify>
1. 開発サーバーを起動: `npm run dev`
2. ゲスト予約ページ（/guest）でテスト予約を作成
3. 予約確認メールが届くことを確認
4. （オプション）予約をキャンセルしてキャンセルメールが届くことを確認

**確認ポイント:**
- コンソールに `[Email] User email sent:` のログが出ている
- 指定したメールアドレスに実際にメールが届く
- メールの送信元が新しいFROM_EMAILになっている
  </how-to-verify>
  <resume-signal>メールが正常に届いたら "approved"、問題があれば詳細を記載</resume-signal>
</task>

</tasks>

<verification>
- `isEmailConfigured()`が`true`を返す
- 予約作成時にメールが送信される
- Resendダッシュボードで送信ログが確認できる
</verification>

<success_criteria>
- FROM_EMAILがカスタムドメインのアドレスに設定されている
- テスト予約でメールが実際に送信・受信される
</success_criteria>

<output>
完了後、STATE.mdのQuick Tasks Completedに追記
</output>
