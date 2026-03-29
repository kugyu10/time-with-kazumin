# Phase 16: 会員アクティビティ表示 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-29
**Phase:** 16-member-activity
**Areas discussed:** 色分けの表示方法, ダッシュボードのフォローリスト, 「来ていない」の判定基準

---

## 色分けの表示方法

| Option | Description | Selected |
|--------|-------------|----------|
| 行背景色 | テーブル行全体を黄色/赤の淡い背景でハイライト。一目で分かる | ✓ |
| バッジ表示 | 名前横に「要フォロー」バッジ。控えめだがテーブルデザインを崩さない | |
| おまかせ | Claudeの判断 | |

**User's choice:** 行背景色（推奨）

| Option | Description | Selected |
|--------|-------------|----------|
| 追加する | 「前回セッション」カラムを追加。「XX日前」形式で直感的 | ✓ |
| 追加しない | 色分けのみで十分 | |

**User's choice:** 追加する（推奨）

---

## ダッシュボードのフォローリスト

| Option | Description | Selected |
|--------|-------------|----------|
| シンプルテーブル | 名前・プラン・前回セッション日のコンパクトなテーブル。黄色・赤セクションに分けて表示 | ✓ |
| カードリスト | 各会員をカードで表示。視覚的だが情報密度が低い | |
| おまかせ | Claudeの判断 | |

**User's choice:** シンプルテーブル（推奨）

---

## 「来ていない」の判定基準

| Option | Description | Selected |
|--------|-------------|----------|
| 完了済み予約の最新日 | status='completed' の max(end_time)。実際にセッションが行われた日を基準 | ✓ |
| 全予約の最新日 | キャンセル以外の全予約の max(end_time)。確定済みだが未完了も含む | |

**User's choice:** 完了済み予約の最新日（推奨）

| Option | Description | Selected |
|--------|-------------|----------|
| 将来のconfirmed予約あり→フォロー不要 | status='confirmed' AND start_time > now() の予約があればフォロー対象外 | ✓ |
| おまかせ | Claudeの判断 | |

**User's choice:** 将来のconfirmed予約あり→フォロー不要（推奨）

---

## Claude's Discretion

- 黄色/赤のCSS色コード
- 前回セッションカラムのソート
- ダッシュボードリストの件数上限
- セッション実績なし会員の表示

## Deferred Ideas

None — discussion stayed within phase scope
