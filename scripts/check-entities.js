#!/usr/bin/env node
'use strict';

/**
 * DB-less TypeORM entity metadata check, run at image build time.
 *
 * Why: on 2026-10-30 prod crash-looped for ~3.5h because an entity column
 * typed `string | null` had no explicit `type`. TypeScript emits
 * design:type Object for that, so TypeORM throws DataTypeNotSupportedError
 * during DataSource.initialize(), Nest never boots, and Cloudflare serves 502.
 * tsc and jest do not catch this. Building the metadata (without connecting
 * to any database) does.
 *
 * Usage: node scripts/check-entities.js [distDir]   (default: dist)
 */

require('reflect-metadata');

const fs = require('fs');
const path = require('path');
const { DataSource } = require('typeorm');

async function main() {
  const distDir = path.resolve(process.argv[2] || 'dist');
  if (!fs.existsSync(distDir) || !fs.statSync(distDir).isDirectory()) {
    console.error('[check-entities] FAILED: dist dir not found: ' + distDir);
    process.exit(1);
  }

  const glob = path
    .join(distDir, '**', '*.entity.js')
    .split(path.sep)
    .join('/');

  // `database` is mandatory, otherwise a different error is thrown.
  // initialize() is deliberately NOT called: no DB connection is needed.
  const ds = new DataSource({
    type: 'mysql',
    database: 'entity_check',
    entities: [glob],
  });

  await ds.buildMetadatas();

  const count = ds.entityMetadatas.length;
  if (count === 0) {
    console.error(
      '[check-entities] FAILED: 0 entities matched ' + glob + ' (glob mismatch?)',
    );
    process.exit(1);
  }

  console.log('[check-entities] OK: ' + count + ' entity metadata built from ' + glob);
  process.exit(0);
}

main().catch((err) => {
  console.error(
    '[check-entities] FAILED: ' + (err && err.name) + ': ' + (err && err.message),
  );
  if (err && err.stack) console.error(err.stack);
  process.exit(1);
});
