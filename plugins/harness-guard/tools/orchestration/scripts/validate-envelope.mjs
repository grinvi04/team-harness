#!/usr/bin/env node
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const schema = JSON.parse(readFileSync(new URL('../schemas/envelopes.schema.json', import.meta.url)));
const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv, ['uri', 'date-time']);
const validate = ajv.compile(schema);

export function validateEnvelope(value) {
  const valid = validate(value);
  return {
    valid,
    scope: 'schema-only',
    errors: valid ? [] : validate.errors.map(({ instancePath, keyword }) => ({ path: instancePath, rule: keyword })),
  };
}

function main(files) {
  if (files.length === 0) {
    console.error('Usage: node scripts/validate-envelope.mjs FILE.json [FILE.json ...]');
    return 2;
  }
  let status = 0;
  for (const file of files) {
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      console.log(JSON.stringify({ file, valid: false, scope: 'schema-only', error: 'read-error' }));
      status = 2;
      continue;
    }
    let value;
    try {
      value = JSON.parse(text);
    } catch {
      console.log(JSON.stringify({ file, valid: false, scope: 'schema-only', error: 'invalid-json' }));
      status = Math.max(status, 1);
      continue;
    }
    const result = validateEnvelope(value);
    console.log(JSON.stringify({ file, ...result }));
    if (!result.valid) status = Math.max(status, 1);
  }
  return status;
}

function isMain() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMain()) {
  process.exitCode = main(process.argv.slice(2));
}
