import type { APIRoute } from 'astro';
import { pool } from '../../../lib/db';
import { handle, json, requireUser } from '../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = handle(async (ctx) => {
  const user = await requireUser(ctx);
  const { rows } = await pool.query('select data from documents where user_id=$1 order by created_at desc', [user.id]);
  return json({ docs: rows.map((r) => r.data) });
});
