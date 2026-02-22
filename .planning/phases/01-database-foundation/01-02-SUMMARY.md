# Plan 01-02 Summary: RLSとStored Procedures

**完了日:** 2026-02-22
**ステータス:** 完了

## 成果物

### RLSポリシー権限マトリックス

| テーブル | anon | member (auth) | admin (auth) |
|---------|------|---------------|--------------|
| profiles | - | 自分のみ参照/更新 | 全参照/更新/作成 |
| plans | アクティブのみ参照 | アクティブのみ参照 | 全操作 |
| member_plans | - | 自分のみ参照 | 全操作 |
| meeting_menus | アクティブのみ参照 | アクティブのみ参照 | 全操作 |
| weekly_schedules | 全参照 | 全参照 | 全操作 |
| bookings | - | 自分の予約のみ | 全操作 |
| point_transactions | - | 自分の履歴のみ | 全参照 |
| app_settings | - | - | 全操作 |

### RLSポリシー数

- **合計: 21ポリシー**
- profiles: 5ポリシー
- plans: 2ポリシー
- member_plans: 2ポリシー
- meeting_menus: 2ポリシー
- weekly_schedules: 2ポリシー
- bookings: 5ポリシー
- point_transactions: 2ポリシー
- app_settings: 1ポリシー

### Stored Procedures

| 関数名 | 目的 | 実行権限 | ロックパターン |
|--------|------|----------|---------------|
| consume_points() | ポイント消費 | authenticated | SELECT FOR UPDATE NOWAIT |
| refund_points() | ポイント返還 | authenticated | SELECT FOR UPDATE |
| grant_monthly_points() | 月次ポイント付与 | service_role | SELECT FOR UPDATE |
| manual_adjust_points() | 手動ポイント調整 | service_role | SELECT FOR UPDATE |

### consume_points() 使用例

```typescript
// アプリケーション層での呼び出し
async function consumePointsWithRetry(
  memberPlanId: number,
  points: number,
  bookingId?: number,
  maxRetries = 3
) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const { data, error } = await supabase.rpc('consume_points', {
        p_member_plan_id: memberPlanId,
        p_points: points,
        p_transaction_type: 'consume',
        p_reference_id: bookingId,
        p_notes: null
      });

      if (error) throw error;
      return data; // 新しい残高
    } catch (error) {
      // ロック競合時はリトライ
      if (error.code === '55P03') {
        await sleep(100 * Math.pow(2, i));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Failed after retries');
}
```

### エラーハンドリング

| エラーコード | 意味 | 対処 |
|-------------|------|------|
| 55P03 | lock_not_available | Exponential backoffでリトライ |
| P0001 | Insufficient points | ユーザーに残高不足を通知 |
| P0001 | Member plan not found | 会員プランIDの確認 |

## ファイル一覧

| ファイル | 行数 | 目的 |
|---------|------|------|
| supabase/migrations/20260222000002_rls_policies.sql | ~150 | RLSポリシー定義 |
| supabase/migrations/20260222000003_stored_procedures.sql | ~200 | ポイント操作関数 |
| supabase/rollback/20260222000002_rls_policies_down.sql | ~35 | RLSロールバック |
| supabase/rollback/20260222000003_stored_procedures_down.sql | ~10 | 関数ロールバック |

## セキュリティ設計

### JWT Claim構造

```json
{
  "sub": "user-uuid",
  "app_metadata": {
    "role": "member"  // "guest", "member", "admin"
  }
}
```

### RLSパフォーマンス最適化

- `auth.jwt()`呼び出しは`SELECT`でラップしてキャッシュ化
- 外部キー参照にはインデックス使用
- サブクエリはSELECTでラップ

### SECURITY DEFINER関数の保護

- `SET search_path = public` でスキーマ混入攻撃を防止
- `REVOKE/GRANT` で適切なロールのみに実行権限を付与
- 関数内でバリデーション実施

## Phase 2への引き継ぎ事項

1. **Sagaパターン実装時のポイント処理**
   - 予約作成前に`consume_points()`でポイント消費
   - 失敗時は`refund_points()`で補償処理
   - 全操作をtry-catchでラップ

2. **管理者ロールの設定**
   - Supabase Dashboard → Authentication → Users
   - app_metadata に `{"role": "admin"}` を設定

3. **ゲスト予約のアクセス制御**
   - anonキーでは直接アクセス不可
   - API Route Handler (service_role) 経由でアクセス
   - guest_tokenでの認証はアプリケーション層で実装

4. **月次ポイント付与（Phase 6）**
   - Edge Functionsから`grant_monthly_points()`を呼び出し
   - service_role keyが必要
