import pg from 'pg';

const globalForPg = globalThis as unknown as { __pool?: pg.Pool };

export const pool: pg.Pool =
  globalForPg.__pool ??
  (globalForPg.__pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 }));
