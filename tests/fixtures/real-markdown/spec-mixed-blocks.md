# 手書き仕様メモ

本文の導入です。<kbd>Ctrl</kbd> + <kbd>S</kbd> で保存します。

> 重要: この仕様は暫定です。
> 利用者レビュー後に確定します。

<div class="note">HTML block note</div>

## 操作手順

1. 申請を開く
   - 入力内容を確認する
   - 添付ファイルを確認する
     1. PDF を確認する
     2. CSV を確認する
2. 承認する

```ts
export function approve(requestId: string): string {
  const normalized = requestId.trim().toUpperCase();
  return `APPROVED:${normalized}`;
}

export function reject(requestId: string, reason: string): string {
  return `REJECTED:${requestId}:${reason}`;
}
```

## データ項目

この段落は 1 つ目の表の前に残す。

| 項目 | 型 | 備考 |
| --- | --- | --- |
| requestId | string | 申請ID |
| amount | number | 金額 |

この段落は表と表の間に残す。

| 状態 | 説明 |
| --- | --- |
| draft | 下書き |
| approved | 承認済み |

最後の補足です。
