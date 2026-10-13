import type { APIRoute } from 'astro';
import { pool } from '../../../lib/db';
import { body, checkOrigin, handle, HttpError, json, randomToken, rateLimit, sha } from '../../../lib/auth';
import { sendVerificationEmail } from '../../../lib/email';

export const prerender = false;

export const POST: APIRoute = handle(async (ctx) => {
  checkOrigin(ctx);
  const { email = '' } = await body(ctx);
  const mail = String(email).trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) throw new HttpError(400, 'Email tidak valid.');
  rateLimit(`resend:${ctx.clientAddress}:${mail}`, 4, 15 * 60_000);

  const { rows } = await pool.query('select id,name,email,email_verified_at,active from users where lower(email)=$1', [mail]);
  const user = rows[0];

  // Jangan bocorkan apakah email terdaftar atau tidak.
  if (!user || !user.active || user.email_verified_at) {
    return json({ ok: true, message: 'Jika akun membutuhkan aktivasi, email aktivasi akan dikirim.' });
  }

  const token = randomToken();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('delete from email_verification_tokens where user_id=$1', [user.id]);
    await client.query(
      'insert into email_verification_tokens (token_hash,user_id,expires_at) values ($1,$2,$3)',
      [sha(token), user.id, expires],
    );
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }

  const origin = String(process.env.APP_URL || new URL(ctx.request.url).origin);
  await sendVerificationEmail({ to: user.email, name: user.name, token, appUrl: origin });
  return json({ ok: true, message: 'Email aktivasi baru sudah dikirim.' });
});
