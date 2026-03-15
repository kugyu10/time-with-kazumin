# コーディング規約

## UTC/JST変換規約

### 背景

Vercel（本番環境・Preview環境）はUTCタイムゾーンで動作します。
そのため、`new Date()` や `toLocaleString()` にタイムゾーンを指定しないと、
ローカル開発環境（JST）では正しく見えても、Vercelデプロイ時にUTC表示になります。

### ルール

**日時を表示するすべての箇所に `timeZone: "Asia/Tokyo"` を必ず指定すること。**

---

### NGパターン

```typescript
// NG: timeZone 未指定 - Vercel(UTC環境)ではUTC時刻で表示される
const time = date.toLocaleTimeString("ja-JP", {
  hour: "2-digit",
  minute: "2-digit",
})

// NG: date-fns の format() は timeZone オプション非対応
import { format } from "date-fns"
const time = format(date, "HH:mm")  // timeZone が効かない
```

### OKパターン

```typescript
// OK: timeZone: "Asia/Tokyo" を指定
const time = date.toLocaleTimeString("ja-JP", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Tokyo",
})

// OK: toLocaleDateString も同様
const date = new Date(isoString).toLocaleDateString("ja-JP", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
  timeZone: "Asia/Tokyo",
})
```

---

### date-fns の使用制限

`date-fns` の `format()` 関数は `timeZone` オプションに対応していません。
日時フォーマット用途では **使用禁止** とします（YAGNI原則: date-fns-tz の追加インストール不要）。

代替として `toLocaleString` / `toLocaleDateString` / `toLocaleTimeString` に
`timeZone: "Asia/Tokyo"` を指定する方法を使うこと。

---

### 参照実装

正しいJST変換の参考実装: `src/emails/BookingConfirmation.tsx`

```typescript
function formatDateTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",  // これが必須
  })
}
```
