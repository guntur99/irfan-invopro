import type { APIRoute } from 'astro';
import { pool } from '../../../lib/db';
import { body, checkOrigin, createSession, handle, HttpError, json, rateLimit, verifyPassword } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = handle(async (ctx) => {
  checkOrigin(ctx);
  const { email = '', password = '' } = await body(ctx);
  const mail = String(email).trim().toLowerCase();
  rateLimit(`${ctx.clientAddress}:${mail}`);
  const { rows } = await pool.query('select * from users where lower(email)=$1', [mail]);
  const u = rows[0];
  if (!u || !(await verifyPassword(String(password), u.password_hash))) throw new HttpError(401, 'Email atau password salah.');
  if (!u.active) throw new HttpError(403, 'Akun ini sedang dinonaktifkan.');
  await createSession(ctx, u.id);
  return json({ user: { id: u.id, email: u.email, name: u.name, role: u.role, active: u.active } });
});
