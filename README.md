# Link Shelf

Link Shelf is a personal catalog for publishing and organizing cloud-drive
share links. It stores only link metadata; files remain with their original
cloud-drive provider.

## MVP scope

- The repository owner is the only publisher.
- Import links in bulk from CSV.
- Browse links by category and tag.
- Search titles and descriptions.
- Copy a share URL and access code.
- Mark links as active or unavailable.
- Publish the static site with GitHub Pages.

## Zero-cost architecture

- Static site: Astro
- Link data: version-controlled JSON
- Bulk publishing: a local CSV import and validation script
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
  "category": "documents",
  "tags": ["example"],
  "description": "Short description",
  "status": "active",
  "publishedAt": "2026-07-27"
}
```

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
node scripts/import.mjs data/batch-import.txt

git add data/links.json data/batch-import.txt
git commit -m "增量添加链接"
git push origin main