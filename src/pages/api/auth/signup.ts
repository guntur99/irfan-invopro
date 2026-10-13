import type { APIRoute } from 'astro';
import { pool } from '../../../lib/db';
import { body, checkOrigin, handle, hashPassword, HttpError, json, rateLimit } from '../../../lib/auth';

export const prerender = false;

// User pertama otomatis Admin. Setelah itu signup publik hanya jika ALLOW_SIGNUP=true;
// selain itu akun dibuat Admin lewat Users & Access.
export const POST: APIRoute = handle(async (ctx) => {
  checkOrigin(ctx);
  rateLimit(`signup:${ctx.clientAddress}`, 5);
  const { email = '', password = '', name = '' } = await body(ctx);
  const mail = String(email).trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) throw new HttpError(400, 'Email tidak valid.');
  if (String(password).length < 6) throw new HttpError(400, 'Password minimal 6 karakter.');
  const hash = await hashPassword(String(password));
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('lock table users in share row exclusive mode');
    const { rows } = await client.query('select count(*)::int as n from users');
    const first = rows[0].n === 0;
    if (!first && process.env.ALLOW_SIGNUP !== 'true') throw new HttpError(403, 'Pendaftaran ditutup. Minta Admin membuat akun.');
    await client.query('insert into users (email,name,password_hash,role) values ($1,$2,$3,$4)', [
      mail, String(name).trim() || mail.split('@')[0], hash, first ? 'Admin' : 'User',
    ]);
    await client.query('commit');
  } catch (e: any) {
    await client.query('rollback');
    if (e?.code === '23505') throw new HttpError(409, 'Email sudah terdaftar.');
    throw e;
  } finally {
    client.release();
  }
  return json({ ok: true });
});
