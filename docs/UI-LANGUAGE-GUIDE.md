# UI言語対応ガイド

## 概要

Open Operatorでは日本語と英語の両言語をサポートしています。新しいUIコンポーネントを作成する際は、必ず多言語対応を行ってください。

## 基本的な手順

### 1. 言語定義ファイルの更新

新しいUIテキストを`app/constants/languages.ts`に追加してください。

```typescript
export const languages = {
  ja: {
    // 既存の項目...
    
    // 新しいUIコンポーネント用のテキスト
    newFeatureTitle: '新機能',
    newFeatureDesc: '新しい機能の説明です',
    confirmButton: '確認',
    cancelButton: 'キャンセル',
  },
  en: {
    // 既存の項目...
    
    // 新しいUIコンポーネント用のテキスト
    newFeatureTitle: 'New Feature',
    newFeatureDesc: 'Description of the new feature',
    confirmButton: 'Confirm',
    cancelButton: 'Cancel',
  },
} as const;
```

### 2. コンポーネントでの使用方法

```typescript
import { getLanguageText } from "@/app/constants/languages";
import { useSettings } from "@/app/hooks/useSettings";

export function NewComponent() {
  const { settings } = useSettings();
  const currentLanguage = settings.language || 'ja';
  const t = (key: string) => getLanguageText(currentLanguage, key);

  return (
    <div>
      <h1>{t('newFeatureTitle')}</h1>
      <p>{t('newFeatureDesc')}</p>
      <button>{t('confirmButton')}</button>
      <button>{t('cancelButton')}</button>
    </div>
  );
}
```

## コーディング規則

### 必須事項

1. **全てのユーザー向けテキストを多言語化**
   - ボタンラベル
   - タイトル、見出し
   - 説明文
   - エラーメッセージ
   - プレースホルダーテキスト

2. **両言語での統一性**
   - 日本語と英語の両方で意味が一致していること
   - UIの長さを考慮した適切な翻訳

3. **キーの命名規則**
   - 機能名 + 要素の種類の形式を推奨
   - 例: `userProfileTitle`, `settingsDesc`, `saveButton`

### 推奨事項

1. **コンテキストの明確化**
   ```typescript
   // 良い例：コンテキストが明確
   profileSettingsTitle: 'プロフィール設定',
   accountSettingsTitle: 'アカウント設定',
   
   // 悪い例：曖昧
   settingsTitle: '設定',
   ```

2. **動的テキストの対応**
   ```typescript
   // プレースホルダーを使用
   ja: {
     welcomeMessage: 'こんにちは、{name}さん！',
     itemCount: '{count}個のアイテム',
   },
   en: {
     welcomeMessage: 'Hello, {name}!',
     itemCount: '{count} items',
   }
   
   // 使用例
   const message = t('welcomeMessage').replace('{name}', userName);
   ```

## ファイル構成例

新しい機能を追加する際の推奨ディレクトリ構成：

```
app/
├── components/
│   └── NewFeature/
│       ├── NewFeatureModal.tsx     # 多言語対応済み
│       ├── NewFeatureForm.tsx      # 多言語対応済み
│       └── index.ts
├── constants/
│   └── languages.ts                # 更新必要
└── hooks/
    └── useNewFeature.ts
```

## チェックリスト

新しいUIコンポーネントをリリースする前に確認してください：

- [ ] `languages.ts`に日本語テキストを追加済み
- [ ] `languages.ts`に英語テキストを追加済み
- [ ] コンポーネントで`useSettings`と`getLanguageText`を使用
- [ ] ハードコードされたテキストが残っていない
- [ ] 両言語でUIテストを実施済み
- [ ] 長いテキストでのレイアウト崩れを確認済み

## よくある問題と対処法

### 1. テキストの長さの違い

```css
/* 言語によってテキスト長が異なることを考慮 */
.button-text {
  min-width: 100px; /* 最小幅を設定 */
  text-align: center;
}
```

### 2. 動的なテキスト挿入

```typescript
// 複数のプレースホルダーがある場合
const formatText = (template: string, values: Record<string, string>) => {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, value),
    template
  );
};

// 使用例
const text = formatText(t('multipleValues'), {
  name: userName,
  count: itemCount.toString(),
  date: formatDate(new Date())
});
```

### 3. 条件付きテキスト

```typescript
// 単数形/複数形の対応
const getCountText = (count: number) => {
  if (currentLanguage === 'ja') {
    return t('itemCount').replace('{count}', count.toString());
  } else {
    return count === 1 
      ? t('singleItem').replace('{count}', count.toString())
      : t('multipleItems').replace('{count}', count.toString());
  }
};
```

## 既存コンポーネントの参考例

- `app/components/Settings/SettingsModal.tsx`
- `app/components/Chat/ChatInterface.tsx`
- `app/components/Chat/WelcomeScreen.tsx`

これらのファイルで多言語対応の実装例を確認できます。

---

**重要**: 新機能のUIを作成する際は、最初から多言語対応を考慮して設計してください。後から追加するよりも効率的で、バグを防ぐことができます。 