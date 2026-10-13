import type { APIRoute } from 'astro';
import { pool } from '../../../lib/db';
import { body, checkOrigin, handle, hashPassword, HttpError, json, randomToken, rateLimit, roleForEmail, sha } from '../../../lib/auth';
import { sendVerificationEmail } from '../../../lib/email';

export const prerender = false;

export const POST: APIRoute = handle(async (ctx) => {
  checkOrigin(ctx);
  rateLimit(`signup:${ctx.clientAddress}`, 5);

  const { email = '', password = '', name = '' } = await body(ctx);
  const mail = String(email).trim().toLowerCase();
  const cleanName = String(name).trim() || mail.split('@')[0];
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) throw new HttpError(400, 'Email tidak valid.');
  if (String(password).length < 6) throw new HttpError(400, 'Password minimal 6 karakter.');

  const token = randomToken();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const client = await pool.connect();
  let userId = '';

  try {
    await client.query('begin');
    const { rows } = await client.query(
      `insert into users (email,name,password_hash,role,email_verified_at)
       values ($1,$2,$3,$4,null)
       returning id`,
      [mail, cleanName, await hashPassword(String(password)), roleForEmail(mail)],
    );
    userId = rows[0].id;
    await client.query('delete from email_verification_tokens where user_id=$1', [userId]);
    await client.query(
      'insert into email_verification_tokens (token_hash,user_id,expires_at) values ($1,$2,$3)',
      [sha(token), userId, expires],
    );
    await client.query('commit');
  } catch (e: any) {
    await client.query('rollback');
    if (e?.code === '23505') throw new HttpError(409, 'Email sudah terdaftar. Silakan login atau kirim ulang email aktivasi.');
    throw e;
  } finally {
    client.release();
  }

  let emailSent = true;
  try {
    const origin = String(process.env.APP_URL || new URL(ctx.request.url).origin);
    await sendVerificationEmail({ to: mail, name: cleanName, token, appUrl: origin });
  } catch (e) {
    console.error('Verification email failed', e);
    emailSent = false;
  }

  return json({
    ok: true,
    emailSent,
    message: emailSent
      ? 'Akun dibuat. Cek email untuk aktivasi akun.'
      : 'Akun dibuat, tetapi email aktivasi belum terkirim. Gunakan Kirim Ulang Aktivasi.',
  });
});
