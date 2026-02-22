# Phase 5: 管理機能 - Research

**Researched:** 2026-02-22
**Domain:** Admin dashboard implementation with Next.js 15 App Router + Supabase
**Confidence:** HIGH

## Summary

Phase 5では、管理者向けのCRUD管理画面を実装します。shadcn/uiのデータテーブル + TanStack Tableの組み合わせが2026年の標準パターンです。Next.js 15 App RouterのServer Componentsでデータ取得を行い、Server Actionsで更新処理を実装します。Supabaseのservice_roleクライアントを使用してRLSをバイパスし、管理者専用の操作を実現します。

重要なセキュリティポイント: Server ActionsはPUBLIC HTTPエンドポイントです。Middlewareだけに依存せず、各Server Action内で認証・認可チェックを実装する必要があります(CVE-2025-29927対策)。

**Primary recommendation:** shadcn/ui Data Table + React Hook Form + Zod + Server Actionsの組み合わせで、各CRUDリソース(営業時間、予約、会員、ポイント、メニュー、プラン)ごとに個別のルートとテーブルを作成する。

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ADMIN-01 | 曜日別の営業時間を設定できる（祝日は別パターン） | weekly_schedulesテーブルのCRUD、day_of_weekとis_holiday_patternフィールド利用 |
| ADMIN-03 | 全予約一覧を確認・ステータス変更・キャンセルできる | bookingsテーブルの全件取得、ステータス更新、キャンセルオーケストレーター再利用 |
| ADMIN-04 | 会員を招待・登録・退会させることができる | profilesテーブルのCRUD、Supabase Auth API統合 |
| ADMIN-05 | 会員のポイントを手動で付与/減算できる | manual_adjust_points() stored procedure利用 |
| ADMIN-06 | メニュー（セッション種別）をCRUD管理できる | meeting_menusテーブルのCRUD |
| ADMIN-07 | プラン（サブスクプラン）をCRUD管理できる | plansテーブルのCRUD |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| shadcn/ui Data Table | Latest | データテーブルコンポーネント | TanStack Table統合、ソート・フィルタ・ページネーション内蔵、最も人気のあるReact管理画面テンプレート |
| TanStack Table | v8 | テーブルロジック(Headless UI) | フレキシブルなテーブル実装、10,000+行対応 |
| React Hook Form | Latest | フォーム管理 | shadcn/ui公式推奨、Zod統合、型安全 |
| Zod | Latest | スキーマバリデーション | TypeScript統合、Server Actions入力検証に必須 |
| Next.js 15 Server Actions | Built-in | CRUD操作のバックエンド | App Routerネイティブ、サーバーサイド処理 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | Latest | 日付フォーマット | 予約日時表示、日本語対応 |
| validator | Latest | 入力検証 | メールアドレス、数値範囲チェック(Phase 3で既に使用) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack Table | AG Grid, react-data-grid | 商用ライセンス必要、オーバースペック、shadcn/ui未統合 |
| shadcn/ui Form | Formik | React Hook Formの方がshadcn/ui公式推奨、Zod統合良好 |
| Server Actions | API Routes (app/api) | Server Actionsの方がApp Routerネイティブ、コロケーション良好 |

**Installation:**
```bash
# Data Table
pnpm dlx shadcn@latest add table
pnpm add @tanstack/react-table

# Form components
pnpm dlx shadcn@latest add form
pnpm add react-hook-form @hookform/resolvers zod

# Additional UI components (as needed)
pnpm dlx shadcn@latest add dropdown-menu dialog select checkbox
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   └── (admin)/               # Admin route group
│       ├── layout.tsx         # 管理画面共通レイアウト(サイドバー+ヘッダー)
│       ├── dashboard/         # ダッシュボード(概要)
│       ├── schedules/         # 営業時間設定
│       ├── bookings/          # 全予約一覧
│       ├── members/           # 会員管理
│       ├── menus/             # メニュー管理
│       └── plans/             # プラン管理
├── lib/
│   ├── supabase/
│   │   ├── admin.ts           # Service role client (server-side only)
│   │   └── service-role.ts    # 代替名(明示的にservice role使用を示す)
│   └── actions/
│       └── admin/             # Admin server actions
│           ├── schedules.ts
│           ├── bookings.ts
│           ├── members.ts
│           ├── points.ts
│           ├── menus.ts
│           └── plans.ts
└── components/
    └── admin/                 # Admin-specific components
        ├── data-tables/       # Table components per resource
        ├── forms/             # Form components per resource
        └── sidebar.tsx        # Admin navigation
```

### Pattern 1: Admin Route Protection (Nested Layout Pattern)
**What:** (admin)ルートグループで管理者専用レイアウトを作成し、全ページを保護する
**When to use:** 全管理画面で共通のサイドバー・ヘッダーが必要な場合
**Example:**
```typescript
// src/app/(admin)/layout.tsx
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import AdminSidebar from '@/components/admin/sidebar';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check admin role from profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    redirect('/');
  }

  return (
    <div className="flex h-screen">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
```

### Pattern 2: Server Component Data Fetching + Service Role Client
**What:** Server Componentでservice_roleクライアントを使用してRLSバイパスで全データ取得
**When to use:** 管理者が全ユーザーのデータを閲覧する必要がある場合
**Example:**
```typescript
// src/lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

// Service role client - NEVER expose to client
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role key
    {
      auth: {
        persistSession: false,
      },
    }
  );
}

// src/app/(admin)/bookings/page.tsx - Server Component
import { createAdminClient } from '@/lib/supabase/admin';
import BookingsTable from '@/components/admin/data-tables/bookings-table';

export default async function BookingsPage() {
  const supabase = createAdminClient();

  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      *,
      member_plans (
        user:profiles (
          email,
          full_name
        )
      ),
      menu:meeting_menus (
        name,
        duration_minutes
      )
    `)
    .order('start_time', { ascending: false });

  return <BookingsTable data={bookings || []} />;
}
```

### Pattern 3: Server Actions with Defense-in-Depth Auth
**What:** Server Action内で認証・認可・入力検証を全て実施(ミドルウェアだけに依存しない)
**When to use:** 全てのServer Actions(PUBLIC HTTPエンドポイント)
**Example:**
```typescript
// src/lib/actions/admin/menus.ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const menuSchema = z.object({
  name: z.string().min(1).max(100),
  duration_minutes: z.number().int().min(15).max(480),
  points_required: z.number().int().min(0),
  zoom_account: z.enum(['A', 'B']),
  description: z.string().optional(),
  is_active: z.boolean(),
});

export async function createMenu(formData: z.infer<typeof menuSchema>) {
  // 1. Input validation
  const validated = menuSchema.parse(formData);

  // 2. Authentication check
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // 3. Authorization check (admin role)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    throw new Error('Forbidden: Admin access required');
  }

  // 4. Execute with service role client
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from('meeting_menus')
    .insert(validated)
    .select()
    .single();

  if (error) throw error;

  // 5. Revalidate cache
  revalidatePath('/admin/menus');

  return data;
}
```

### Pattern 4: Data Table with CRUD Actions
**What:** TanStack Table + shadcn/ui Data Tableでソート・フィルタ・ページネーション + 行アクション
**When to use:** リスト表示 + CRUD操作が必要な全リソース
**Example:**
```typescript
// src/components/admin/data-tables/menus-table.tsx
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Menu = {
  id: number;
  name: string;
  duration_minutes: number;
  points_required: number;
  zoom_account: 'A' | 'B';
  is_active: boolean;
};

const columns: ColumnDef<Menu>[] = [
  {
    accessorKey: 'name',
    header: 'メニュー名',
  },
  {
    accessorKey: 'duration_minutes',
    header: '時間(分)',
  },
  {
    accessorKey: 'points_required',
    header: 'ポイント',
  },
  {
    accessorKey: 'zoom_account',
    header: 'Zoomアカウント',
  },
  {
    accessorKey: 'is_active',
    header: 'ステータス',
    cell: ({ row }) => row.original.is_active ? '有効' : '無効',
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const menu = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(menu.id)}>
              編集
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToggleActive(menu.id)}>
              {menu.is_active ? '無効化' : '有効化'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

export function MenusTable({ data }: { data: Menu[] }) {
  return <DataTable columns={columns} data={data} />;
}
```

### Pattern 5: React Hook Form + Zod + Server Action
**What:** フォーム入力をZodで検証し、Server Actionで処理
**When to use:** 作成・更新フォーム
**Example:**
```typescript
// src/components/admin/forms/menu-form.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { createMenu } from '@/lib/actions/admin/menus';

const menuSchema = z.object({
  name: z.string().min(1, 'メニュー名は必須です').max(100),
  duration_minutes: z.number().int().min(15, '最低15分').max(480),
  points_required: z.number().int().min(0, '0以上'),
  zoom_account: z.enum(['A', 'B']),
  description: z.string().optional(),
  is_active: z.boolean(),
});

type MenuFormValues = z.infer<typeof menuSchema>;

export function MenuForm({ onSuccess }: { onSuccess?: () => void }) {
  const form = useForm<MenuFormValues>({
    resolver: zodResolver(menuSchema),
    defaultValues: {
      name: '',
      duration_minutes: 60,
      points_required: 1,
      zoom_account: 'A',
      description: '',
      is_active: true,
    },
  });

  async function onSubmit(values: MenuFormValues) {
    try {
      await createMenu(values);
      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error('Failed to create menu:', error);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>メニュー名</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Other fields... */}
        <Button type="submit">作成</Button>
      </form>
    </Form>
  );
}
```

### Pattern 6: Weekly Schedule UI (Simple Form Pattern)
**What:** 曜日別営業時間設定は7行のシンプルなフォーム(重量級スケジューラー不要)
**When to use:** ADMIN-01の営業時間設定
**Example:**
```typescript
// weekly_schedules table structure:
// - day_of_week: 0-6 (0=日曜)
// - is_holiday_pattern: boolean
// - start_time: TIME
// - end_time: TIME

// Simple UI pattern: 2 tabs (平日パターン, 祝日パターン) + 7 rows
// Each row: Day label + Time inputs (start, end) + Enabled checkbox

const DAYS_JP = ['日', '月', '火', '水', '木', '金', '土'];

// Render 7 rows with controlled inputs
// On submit: Bulk upsert to weekly_schedules table
```

### Anti-Patterns to Avoid
- **Middlewareだけで認証・認可を実施:** CVE-2025-29927により、x-middleware-subrequestヘッダーでバイパス可能。Server Action内で必ず認証・認可チェックを実施する。
- **service_role keyをクライアントに露出:** service_roleはRLSをバイパスするため、絶対にクライアント側で使用しない。Server Component/Server Actionのみ。
- **RLS PolicyにService Roleを記述:** service_roleは自動的にRLSバイパスするため、ポリシーに記述する意味はない。
- **重量級スケジューラーライブラリを使用:** 営業時間設定は7行のシンプルなフォームで十分。Syncfusion/KendoReactなどは過剰。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| データテーブルのソート・フィルタ | 独自実装 | TanStack Table + shadcn/ui Data Table | 10,000+行対応済み、アクセシビリティ対応、メンテナンス不要 |
| フォームバリデーション | 独自バリデーション関数 | Zod + React Hook Form | 型安全、エラーハンドリング、shadcn/ui公式推奨 |
| RLSバイパス用カスタムクエリ | RLS無効化 | service_roleクライアント | Supabase公式パターン、セキュリティベストプラクティス |
| スケジューラーUI | 重量級カレンダーライブラリ | shadcn/ui基本コンポーネント(Input, Select, Checkbox) | 要件は7行のシンプルなフォーム、オーバーエンジニアリング回避 |

**Key insight:** 管理画面の多くはCRUD操作であり、shadcn/uiとTanStack Tableの組み合わせで95%のユースケースをカバーできる。カスタム実装はアクセシビリティ・パフォーマンス・メンテナンス性で劣る。

## Common Pitfalls

### Pitfall 1: Server Actionsに認証チェックがない
**What goes wrong:** ミドルウェアで保護しているつもりが、Server ActionsはPUBLIC HTTPエンドポイントなので直接呼び出し可能
**Why it happens:** CVE-2025-29927の認識不足、ミドルウェアだけで十分だと誤解
**How to avoid:** 全Server Actionの冒頭で認証・認可チェックを実装する(Pattern 3参照)
**Warning signs:** Server Action内に`createServerClient().auth.getUser()`の呼び出しがない

### Pitfall 2: service_role keyの誤った取り扱い
**What goes wrong:** 環境変数をクライアントに露出(`NEXT_PUBLIC_`プレフィックス使用)、SSRクライアントでservice_roleを使用
**Why it happens:** Supabaseクライアントパターンの理解不足、service_roleの特権性の認識不足
**How to avoid:** service_roleクライアントはServer Component/Server Actionのみで使用、`NEXT_PUBLIC_`プレフィックスを絶対に使わない
**Warning signs:** `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`という環境変数がある、'use client'コンポーネントでadmin clientをimport

### Pitfall 3: RLS Policyにservice_roleを記述
**What goes wrong:** RLS Policyで`TO service_role`を設定しても効果がない(service_roleは自動的にRLSバイパス)
**Why it happens:** RLSの仕組みとservice_roleの特権性の誤解
**How to avoid:** service_roleはRLS Policyに記述しない。管理者ロールが必要な場合はauthenticated + roleチェックを使用
**Warning signs:** CREATE POLICY ... TO service_role という記述がある

### Pitfall 4: Data Tableのパフォーマンス問題
**What goes wrong:** 10,000+行で描画が遅い、フィルタ・ソートが重い
**Why it happens:** クライアント側で全データを保持、サーバーサイドページネーション未実装
**How to avoid:** TanStack Tableのサーバーサイドページネーション機能を使用、初期ロードは100件程度に制限
**Warning signs:** ブラウザDevToolsでメモリ使用量が異常に高い、スクロールがカクつく

### Pitfall 5: 営業時間設定の過剰実装
**What goes wrong:** 重量級スケジューラーライブラリ導入でバンドルサイズ増大、複雑性上昇
**Why it happens:** 「営業時間設定 = カレンダーUI」という思い込み、実際の要件(7行のフォーム)との乖離
**How to avoid:** weekly_schedulesテーブルは7行(day_of_week 0-6)のシンプルなフォームで十分。shadcn/ui基本コンポーネントで実装
**Warning signs:** Syncfusion、KendoReact、DevExtremeなどの商用ライブラリ導入を検討している

### Pitfall 6: ポイント調整の監査証跡不足
**What goes wrong:** 管理者によるポイント手動調整が追跡できない、不正操作の検出不可
**Why it happens:** manual_adjust_points()にnotesパラメータを渡していない、理由入力UIがない
**How to avoid:** ポイント調整フォームに理由入力欄(必須)を設ける、point_transactionsテーブルにnotesが記録されることを確認
**Warning signs:** ポイント調整フォームに理由入力欄がない、point_transactionsのnotesカラムがNULLばかり

## Code Examples

Verified patterns from official sources:

### shadcn/ui Data Table Installation
```bash
# Source: https://ui.shadcn.com/docs/components/radix/data-table
pnpm dlx shadcn@latest add table
pnpm add @tanstack/react-table
```

### React Hook Form + Zod Pattern
```typescript
// Source: https://ui.shadcn.com/docs/forms/react-hook-form
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"

const formSchema = z.object({
  title: z.string().min(5, "最低5文字").max(32, "最大32文字"),
  description: z.string().min(20, "最低20文字").max(100, "最大100文字"),
})

export function MyForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", description: "" },
  })

  function onSubmit(values: z.infer<typeof formSchema>) {
    // Server action call
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* Fields */}
      </form>
    </Form>
  )
}
```

### Supabase Service Role Client
```typescript
// Source: https://supabase.com/docs/guides/database/postgres/roles
import { createClient } from '@supabase/supabase-js';

// Server-side only - bypasses RLS
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role key
    {
      auth: {
        persistSession: false,
      },
    }
  );
}
```

### Server Action with Defense-in-Depth Auth
```typescript
// Source: https://nextjs.org/docs/app/guides/authentication (2026 guidance)
'use server';

export async function adminAction(data: SomeType) {
  // 1. Input validation
  const validated = schema.parse(data);

  // 2. Authentication check
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // 3. Authorization check
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    throw new Error('Forbidden');
  }

  // 4. Execute operation
  // ...
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pages Router + API Routes | App Router + Server Actions | Next.js 13 (2022), 安定化 14-15 (2023-2024) | コロケーション向上、TypeScript統合強化 |
| AG Grid, react-data-grid | TanStack Table + shadcn/ui | 2023-2024 | オープンソース、カスタマイズ性、バンドルサイズ削減 |
| Formik | React Hook Form + Zod | 2022-2024 | パフォーマンス向上(再レンダリング削減)、TypeScript統合 |
| Middleware認証のみ | Defense-in-Depth (Server Action内認証) | 2025年3月(CVE-2025-29927公開) | セキュリティ強化、バイパス攻撃防止 |
| カスタムauth実装 | Supabase Auth + RLS | 継続的 | セキュリティ向上、メンテナンス削減 |

**Deprecated/outdated:**
- **Pages Router for new projects**: App Routerが推奨(2024年以降)
- **Middleware only auth**: CVE-2025-29927によりバイパス可能(2025年3月)、Server Action内認証必須
- **AG Grid Free版**: TanStack Tableの方がフレキシブルかつオープンソース
- **重量級スケジューラーライブラリ**: シンプルな営業時間設定にはオーバースペック

## Open Questions

1. **営業時間パターンの切り替えロジック**
   - What we know: weekly_schedulesにis_holiday_patternフィールドあり、平日/祝日の2パターン保存可能
   - What's unclear: 祝日判定ロジック(カレンダーAPIか、手動設定か)
   - Recommendation: Phase 5では2パターン(平日/祝日)のCRUD実装のみ。祝日判定は手動切り替えまたは将来フェーズで祝日カレンダーAPI統合を検討

2. **会員招待フローの詳細**
   - What we know: ADMIN-04で会員招待機能が必要
   - What's unclear: 招待リンク生成か、管理者が直接登録するか
   - Recommendation: MVP優先で管理者直接登録(メール + 初期パスワード設定)。招待リンク機能はv2検討

3. **ポイント調整の承認フロー**
   - What we know: manual_adjust_points() stored procedure存在
   - What's unclear: 承認フロー必要性(管理者が複数いる場合)
   - Recommendation: Phase 5では承認フロー不要(管理者=かずみん本人1名想定)。監査証跡(notes必須)で対応

## Sources

### Primary (HIGH confidence)
- [shadcn/ui Data Table Component](https://ui.shadcn.com/docs/components/radix/data-table) - TanStack Table統合、CRUD操作パターン
- [shadcn/ui React Hook Form Guide](https://ui.shadcn.com/docs/forms/react-hook-form) - 公式フォームパターン、Zod統合
- [Supabase RLS Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security) - service_role、RLSバイパス
- [Supabase Postgres Roles](https://supabase.com/docs/guides/database/postgres/roles) - service_role vs authenticated
- [Supabase RBAC Guide](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) - ロールベースアクセス制御
- [Next.js Authentication Guide](https://nextjs.org/docs/app/guides/authentication) - Server Actions認証パターン

### Secondary (MEDIUM confidence)
- [Next.js Security: A Complete Guide](https://makerkit.dev/blog/tutorials/nextjs-security) - Server Actions security best practices
- [Next.js Server Actions Security: 5 Vulnerabilities You Must Fix](https://makerkit.dev/blog/tutorials/secure-nextjs-server-actions) - セキュリティチェックリスト
- [Supabase RLS Best Practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) - Production patterns
- [Building a CRUD app with Shadcn UI and Refine](https://refine.dev/blog/shadcn-ui/) - CRUD実装パターン
- [shadcn/ui Complete Guide (2026)](https://designrevision.com/blog/shadcn-ui-guide) - 2026年のベストプラクティス

### Tertiary (LOW confidence - security alerts)
- [CVE-2025-29927 - Next.js Middleware Vulnerability](https://securityboulevard.com/2026/01/cve-2025-29927-understanding-the-next-js-middleware-vulnerability-2/) - ミドルウェアバイパス攻撃
- [Critical Security Flaw in Next.js](https://www.developer-tech.com/news/critical-security-flaw-uncovered-next-js-framework/) - セキュリティアラート
- [Audit Logging Best Practices (2026)](https://www.opshub.me/audit-trail-best-practices/) - 監査証跡パターン

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - shadcn/ui + TanStack Tableは2026年のデファクトスタンダード、公式ドキュメント豊富
- Architecture: HIGH - Next.js App Router + Server Actionsパターンは公式推奨、既存フェーズで実績あり
- Security: HIGH - CVE-2025-29927対策、Supabase公式ガイダンス、複数ソースで検証済み
- Pitfalls: MEDIUM-HIGH - セキュリティ脆弱性は公式確認済み、その他は実践的知見に基づく

**Research date:** 2026-02-22
**Valid until:** 2026-04-22 (60 days - Next.jsとSupabaseは安定期、大きな変更は少ない)
