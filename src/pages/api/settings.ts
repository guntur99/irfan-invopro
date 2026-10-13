import type { APIRoute } from 'astro';
import { pool } from '../../lib/db';
import { body, handle, HttpError, json, requireUser } from '../../lib/auth';

export const prerender = false;

export const GET: APIRoute = handle(async (ctx) => {
  const user = await requireUser(ctx);
  const { rows } = await pool.query('select data from user_settings where user_id=$1', [user.id]);
  return json({ settings: rows[0]?.data ?? null });
});

export const PUT: APIRoute = handle(async (ctx) => {
  const user = await requireUser(ctx);
  const data = await body(ctx);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400, 'Invalid settings');
  await pool.query(
    `insert into user_settings (user_id,data) values ($1,$2)
     on conflict (user_id) do update set data=excluded.data, updated_at=now()`,
    [user.id, data],
  );
  return json({ ok: true });
});
