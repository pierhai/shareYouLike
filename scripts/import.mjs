import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRecord } from './validate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// ----- Config -----
const DATA_FILE = join(root, 'data', 'links.json');
const TAG_MAPPINGS_FILE = join(root, 'tag-mappings.json');

// ----- Tag mappings -----
function loadTagMappings() {
  try {
    if (existsSync(TAG_MAPPINGS_FILE)) {
      return JSON.parse(readFileSync(TAG_MAPPINGS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.warn(`⚠️  Failed to parse tag-mappings.json: ${err.message}. Using defaults.`);
  }
  // 默认映射：关键词 -> 标签
  return {
    '付费': '付费',
    '免费': '免费',
    '教程': '教程',
    '课程': '课程',
    '电子书': '电子书',
    '电影': '电影',
    '音乐': '音乐',
    '软件': '软件',
    '漫画': '漫画',
    '小说': '小说',
    '合集': '合集',
  };
}

function generateTags(title, mappings) {
  const tags = [];
  for (const [keyword, tag] of Object.entries(mappings)) {
    if (title.includes(keyword)) {
      tags.push(tag);
    }
  }
  return [...new Set(tags)];
}

// ----- Step 1: Parse share text (Quark / Baidu / etc.) -----
function parseShareText(raw) {
  const records = [];
  const blockRegex = /「([^」]+)」[\s\S]*?链接[：:]\s*(https?:\/\/[^\s]+)/g;

  let match;
  while ((match = blockRegex.exec(raw)) !== null) {
    const title = match[1].trim();
    const url = match[2].trim();

    const urlObj = new URL(url);
    const pathId = urlObj.pathname.split('/').filter(Boolean).pop() || '';
    const id = pathId || Buffer.from(title).toString('base64url').substring(0, 12);

    let provider = 'other';
    if (url.includes('pan.quark.cn')) provider = 'quark';
    else if (url.includes('pan.baidu.com')) provider = 'baidu';
    else if (url.includes('aliyundrive.com') || url.includes('alipan.com')) provider = 'aliyun';
    else if (url.includes('lanzou')) provider = 'lanzou';

    const tags = generateTags(title, loadTagMappings());
    records.push({
      id,
      title,
      url,
      accessCode: '',
      provider,
      tags,
      description: '',
      status: 'active',
      publishedAt: new Date().toISOString().split('T')[0],
    });
  }

  return records;
}

// ----- Step 2: Parse CSV -----
const CSV_HEADER_MAP = {
  'id': 'id',
  'title': 'title',
  'url': 'url',
  'access_code': 'accessCode',
  'accessCode': 'accessCode',
  'provider': 'provider',
  'category': 'category',
  'tags': 'tags',
  'description': 'description',
  'status': 'status',
  'published_at': 'publishedAt',
  'publishedAt': 'publishedAt',
};

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; }
    else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += char; }
  }
  result.push(current.trim());
  return result;
}

function readCSV(filePath) {
  const raw = readFileSync(filePath, 'utf-8').trim();
  const lines = raw.split('\n').filter(line => line.trim() !== '');
  if (lines.length < 2) throw new Error('CSV must have a header and at least one data row');
  const headers = parseCSVLine(lines[0]);
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const record = {};
    for (let j = 0; j < headers.length; j++) {
      const key = CSV_HEADER_MAP[headers[j].trim()];
      if (key) record[key] = (values[j] || '').trim();
    }
    record.tags = (typeof record.tags === 'string' && record.tags.length > 0)
      ? record.tags.split(',').map(t => t.trim()).filter(Boolean)
      : [];
    if (!record.status) record.status = 'active';
    if (!record.publishedAt) record.publishedAt = new Date().toISOString().split('T')[0];
    records.push(record);
  }
  return records;
}

// ----- Step 3: Deduplicate & merge (FIXED) -----
function loadExisting(filePath) {
  if (!existsSync(filePath)) return [];
  try {
    const raw = readFileSync(filePath, 'utf-8').trim();
    if (raw.length === 0) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn('⚠️  links.json does not contain an array. Starting fresh.');
      return [];
    }
    return parsed;
  } catch (err) {
    console.warn(`⚠️  Failed to parse links.json: ${err.message}. Starting fresh.`);
    return [];
  }
}

function migrateCategoryToTags(record) {
  // 将旧的 category 字段迁移到 tags
  if (record.category && record.category !== 'uncategorized') {
    if (!record.tags || !Array.isArray(record.tags)) {
      record.tags = [];
    }
    if (!record.tags.includes(record.category)) {
      record.tags.push(record.category);
    }
  }
  delete record.category;
  if (!record.tags) record.tags = [];
  return record;
}

function mergeRecords(existing, incoming) {
  const map = new Map();
  for (const record of existing) {
    map.set(record.id, migrateCategoryToTags(record));
  }
  let updated = 0, added = 0;
  for (const record of incoming) {
    const migrated = migrateCategoryToTags(record);
    if (map.has(migrated.id)) { map.set(migrated.id, migrated); updated++; }
    else { map.set(migrated.id, migrated); added++; }
  }
  return { merged: Array.from(map.values()), updated, added };
}

// ----- Main -----
function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node scripts/import.mjs <file>');
    console.error('  Supports .txt (share text) and .csv');
    process.exit(1);
  }

  const ext = extname(filePath).toLowerCase();
  let records = [];
  if (ext === '.txt') {
    console.log(`📄 Parsing share text: ${filePath}`);
    records = parseShareText(readFileSync(filePath, 'utf-8'));
  } else if (ext === '.csv') {
    console.log(`📄 Reading CSV: ${filePath}`);
    records = readCSV(filePath);
  } else {
    console.error('❌ Unsupported file type. Use .txt or .csv');
    process.exit(1);
  }

  console.log(`   Found ${records.length} record(s)`);
  if (records.length === 0) {
    console.error('❌ No records found. Check your file format.');
    process.exit(1);
  }

  // Validate
  let hasErrors = false;
  for (let i = 0; i < records.length; i++) {
    const { valid, errors, warnings } = validateRecord(records[i]);
    if (!valid || warnings.length > 0) {
      console.log(`\n--- Record ${i + 1} (id: ${records[i].id}) ---`);
      for (const e of errors) { console.log(`  ❌ ${e}`); hasErrors = true; }
      for (const w of warnings) console.log(`  ⚠️  ${w}`);
    }
  }
  if (hasErrors) {
    console.error('\n❌ Validation failed. Fix errors above and try again.');
    process.exit(1);
  }

  // Merge
  const existing = loadExisting(DATA_FILE);
  const { merged, updated, added } = mergeRecords(existing, records);

  writeFileSync(DATA_FILE, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
  console.log(`\n✅ Done! ${added} added, ${updated} updated, ${merged.length} total in links.json`);
}

main();
