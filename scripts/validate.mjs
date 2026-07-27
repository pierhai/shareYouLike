import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// ----- Load schema -----
const schemaPath = join(root, 'schemas', 'link.schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));

// ----- Simple JSON Schema validator for our needs -----
// We don't pull in a full validator to keep things zero-dependency.
// This covers the schema we defined. If we need more, we can add ajv later.

function validate(record, schema) {
  const errors = [];

  // required
  for (const field of schema.required) {
    if (!(field in record) || record[field] === '' || record[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // type checks
  if (typeof record.id !== 'string') errors.push('id must be a string');
  if (typeof record.title !== 'string' || record.title.length === 0)
    errors.push('title must be a non-empty string');
  if (typeof record.url !== 'string' || !record.url.startsWith('http'))
    errors.push('url must be a valid URL string');

  // provider enum
  const validProviders = schema.properties.provider.enum;
  if (!validProviders.includes(record.provider))
    errors.push(`provider must be one of: ${validProviders.join(', ')}`);

  // status enum
  const validStatuses = schema.properties.status.enum;
  if (!validStatuses.includes(record.status))
    errors.push(`status must be one of: ${validStatuses.join(', ')}`);

  // date format check
  if (record.publishedAt && !/^\d{4}-\d{2}-\d{2}$/.test(record.publishedAt))
    errors.push('publishedAt must be in YYYY-MM-DD format');

  // additional properties check
  for (const key of Object.keys(record)) {
    if (!(key in schema.properties))
      errors.push(`Unknown field: "${key}" is not allowed`);
  }

  // tags type check
  if (record.tags && !Array.isArray(record.tags))
    errors.push('tags must be an array');

  return errors;
}

// ----- Security: sensitive field detection -----
const SENSITIVE_KEYWORDS = ['password', 'secret', 'cookie', 'token', 'api_key', 'apikey', 'private_key'];

function checkSensitiveFields(record) {
  const warnings = [];
  const fieldsToCheck = ['title', 'description', 'url', 'accessCode'];

  for (const field of fieldsToCheck) {
    const value = String(record[field] || '').toLowerCase();
    for (const keyword of SENSITIVE_KEYWORDS) {
      if (value.includes(keyword)) {
        warnings.push(`⚠️  "${field}" may contain sensitive data (matched "${keyword}")`);
      }
    }
  }
  return warnings;
}

// ----- Validate a single record -----
export function validateRecord(record) {
  const errors = validate(record, schema);
  const warnings = checkSensitiveFields(record);
  return { valid: errors.length === 0, errors, warnings };
}

// ----- Validate an array of records -----
export function validateAll(records) {
  const results = [];
  for (let i = 0; i < records.length; i++) {
    const { valid, errors, warnings } = validateRecord(records[i]);
    results.push({ index: i, id: records[i].id, valid, errors, warnings });
  }
  return results;
}

// ----- CLI usage -----
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dataPath = process.argv[2] || join(root, 'data', 'links.json');
  const data = JSON.parse(readFileSync(dataPath, 'utf-8'));
  const records = Array.isArray(data) ? data : [data];
  const results = validateAll(records);

  const failed = results.filter(r => !r.valid);
  console.log(`\nValidated ${results.length} record(s).`);
  console.log(`✅ Passed: ${results.length - failed.length}`);
  console.log(`❌ Failed: ${failed.length}\n`);

  for (const r of results) {
    if (!r.valid || r.warnings.length > 0) {
      console.log(`--- Record ${r.index} (id: ${r.id}) ---`);
      for (const e of r.errors) console.log(`  ❌ ${e}`);
      for (const w of r.warnings) console.log(`  ${w}`);
    }
  }
}
