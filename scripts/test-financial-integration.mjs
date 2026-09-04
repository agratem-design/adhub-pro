// Use a dedicated test database with the financial migrations installed.
// Never pass credentials on the command line or commit them to this file.
import fs from 'node:fs';
import pg from 'pg';

if (!process.env.FINANCIAL_TEST_DATABASE_URL) {
  throw new Error('Set FINANCIAL_TEST_DATABASE_URL to a migrated test database.');
}
const client = new pg.Client({ connectionString: process.env.FINANCIAL_TEST_DATABASE_URL, connectionTimeoutMillis: 10000 });
try {
  await client.connect();
  await client.query(fs.readFileSync(new URL('../supabase/tests/financial-distribution.sql', import.meta.url), 'utf8'));
  console.log('Financial integration checks passed; all fixture rows were rolled back.');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
