# Link Shelf

Link Shelf is a personal catalog for publishing and organizing cloud-drive
share links. It stores only link metadata; files remain with their original
cloud-drive provider.

## MVP scope

- The repository owner is the only publisher.
- Import links in bulk from share text (.txt) or CSV.
- Browse links by tag.
- Search titles and descriptions.
- Copy a share URL and access code.
- Mark links as active or unavailable.
- Publish the static site with GitHub Pages.

## Zero-cost architecture

- Static site: Astro
- Link data: version-controlled JSON
- Bulk publishing: a local import and validation script (supports share text and CSV)
- CI/CD: GitHub Actions
- Hosting: GitHub Pages

This version has no public registration, database, or server-side API. That
keeps operating costs and abuse risks low. A database can be added later if
the publishing workflow outgrows Git-based data management.

## Initial link record

```json
{
  "id": "unique-stable-id",
  "title": "Resource title",
  "url": "https://example.com/share/...",
  "accessCode": "",
  "provider": "baidu",
  "tags": ["example", "documents"],
  "description": "Short description",
  "status": "active",
  "publishedAt": "2026-07-27"
}
```

> **Note:** `category` 字段已废弃，统一使用 `tags` 数组。导入时会自动将旧 `category` 迁移到 `tags`。

The public site must never contain account passwords, cookies, API keys, or
private links that are not intended for anyone with access to the site.

## Delivery order

1. Define and validate the link-data format.
2. Build the CSV-to-JSON batch importer.
3. Build the catalog, search, filtering, and link-detail views.
4. Add GitHub Actions deployment to GitHub Pages.
5. Add broken-link reporting and maintenance tools.

## Content policy

Publish only links that you have the right to distribute. The site should
provide a contact and removal channel before it is made public.

## how to run

### 本地运行
node scripts/import.mjs data/batch-import.txt

### 部署（GitHub Actions 自动）
1. 编辑 `data/batch-import.txt`，粘贴分享文本（格式：`「标题」...链接：https://...`）
2. 可选：编辑 `tag-mappings.json` 自定义关键词→标签映射
3. 提交并推送：
   ```bash
   git add data/batch-import.txt
   git commit -m "增量添加链接"
   git push origin main
   ```
4. GitHub Actions 会自动运行导入脚本并部署到 GitHub Pages

### 标签自动生成
导入时根据标题关键词自动匹配 `tag-mappings.json` 中的规则生成标签。
例如标题"7月30日付费文"会匹配到"付费"关键词，自动添加标签 `["付费"]`。
