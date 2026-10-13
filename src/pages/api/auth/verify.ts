import type { APIRoute } from 'astro';
import { pool } from '../../../lib/db';
import { body, handle, HttpError, json, rateLimit, requireUser, verifyPassword } from '../../../lib/auth';

export const prerender = false;

// Konfirmasi ulang password user yang sedang login (untuk Users & Access).
export const POST: APIRoute = handle(async (ctx) => {
  const user = await requireUser(ctx);
  rateLimit(`verify:${user.id}`);
  const { password = '' } = await body(ctx);
  const { rows } = await pool.query('select password_hash from users where id=$1', [user.id]);
  if (!(await verifyPassword(String(password), rows[0].password_hash))) throw new HttpError(401, 'Password tidak sesuai.');
  return json({ ok: true });
});
