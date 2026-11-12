# Dashi Press — 海外向けAI記事販売ストア

日本についての実用的な英語ガイドをAIで書いて、海外の読者に売るストアです。

- **サイト**: `store/`(静的HTML、GitHub Pagesでそのまま動きます → `https://homestock.app/store/`)
- **自動執筆**: `scripts/store/generate-article.mjs`(Claude APIでガイドを1本生成)
- **自動公開**: `.github/workflows/store-auto-publish.yml`(毎週月・木の10:17 JSTに実行)

## 仕組み

```
GitHub Actions(週2回)
  └─ Claudeが新しいガイドを執筆
       ├─ 無料プレビュー・目次・価格 → store/data/articles.json にコミット → サイトに掲載
       └─ 有料の全文(PDF + Markdown) → Actionsの「Artifacts」に保存(公開リポジトリには入れない)
あなた
  └─ 全文を決済サービスに商品として登録 → 決済リンクを記事に設定 → 販売開始
```

決済リンクがまだない記事は「Coming soon」と表示されます。

## 最初にやること

1. **決済サービスを選ぶ**: Gumroad か Lemon Squeezy がおすすめです。どちらも販売者の代わりに海外の消費税やVATを処理してくれます(Merchant of Record)。商品を売ると購入者に自動でファイルが届きます。
2. **APIキーを登録する**: GitHubリポジトリの Settings → Secrets and variables → Actions で `ANTHROPIC_API_KEY` を追加します。
3. **設定を編集する**: `store/config.js` に連絡先メールアドレス(`contactEmail`)を書きます。ストア全体で1つの決済ページを使うなら `defaultCheckoutUrl` も設定します。
4. **試しに1本生成する**: GitHubの Actions タブ →「Dashi Press — auto-publish a new guide」→ Run workflow。

## 新しい記事が出たら(1本あたり数分)

1. Actionsの実行結果から `guide-<slug>` のArtifactをダウンロードし、**内容を読んで事実を確認します**(下の注意点を参照)。
2. 決済サービスで商品を作り、PDFを添付します。価格は記事のJSONに合わせます。
3. 決済リンクを記事に設定します:
   ```bash
   cd scripts/store && node set-checkout.mjs <slug> https://xxxx.gumroad.com/l/yyyy
   git commit -am "Store: checkout link for <slug>" && git push
   ```

最初から入っている3本(東京・ビジネスメール・京都)はプレビューのみのサンプルです。売る場合は全文を用意するか、削除してください。

PDFが付く前に生成された記事は、Actionsの「Dashi Press — make PDF from an earlier guide」を開き、元の実行のRun ID(URLの `/actions/runs/` の後ろの数字)を入れて実行するとPDFが作られます。

## ローカルで動かす

```bash
cd scripts/store && npm install
ANTHROPIC_API_KEY=... node generate-article.mjs --category "Business"   # 書き込みなしで試すなら --dry-run
node render-pdf.mjs out/<slug>.md   # PDF化(Chromiumと日本語フォントが必要)
cd ../.. && python3 -m http.server 8000   # → http://localhost:8000/store/
```

カテゴリーと価格帯は `scripts/store/niches.json` で変更できます。カテゴリーを指定しない場合は、記事が一番少ないカテゴリーが選ばれます。

## 費用の目安

使用モデルは Claude Opus 5.5($4 / $20 per 1M tokens)です。3,000〜4,000語のガイド1本で、出力と思考を合わせておおむね数万トークンになるため、**1本あたり約$0.5〜$1.5**の見込みです。実際の使用量は実行ログの `Usage` に表示されます。拒否された依頼は、Anthropic推奨の代替モデルでサーバー側が自動的に再試行します(`fallbacks: "default"`)。

## 注意点(事業として運営する場合)

- **AI生成であることを明示しています**: サイトのフッター、記事ページ、利用規約に記載しています。決済サービスの規約でもAI生成コンテンツの表示が求められることがあります。
- **事実確認**: ビザ・税金・料金などの情報は誤りがあると返金やクレームにつながります。プロンプトでは変わりやすい数値を断定しないよう指示していますが、**公開前に人が読む運用を強くおすすめします**。完全に自動で公開したくない場合は、ワークフローの `schedule` を削除して手動実行だけにしてください。
- **返金ポリシー(14日)と特定商取引法の表記**は `store/legal.html` と `store/article.html` に書かれています。実際の運用に合わせて書き換えてください。日本から販売する場合は、特定商取引法に基づく表記(請求があれば開示する形式も可)が必要です。
- **法人化について**: このコードで会社そのものを設立することはできません。最初は個人事業(開業届)で始めて、売上が増えたら法人化を検討する流れが一般的です。具体的な手続きは税理士などの専門家に相談してください。
