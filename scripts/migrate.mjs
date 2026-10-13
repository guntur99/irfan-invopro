import pg from 'pg';
import { readFileSync } from 'node:fs';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL belum di-set'); process.exit(1); }
const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
await client.end();
console.log('Schema OK');
