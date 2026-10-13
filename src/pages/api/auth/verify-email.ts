import type { APIRoute } from 'astro';
import { pool } from '../../../lib/db';
import { handle, HttpError, json, sha } from '../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = handle(async (ctx) => {
  const token = String(new URL(ctx.request.url).searchParams.get('token') || '');
  if (!token) throw new HttpError(400, 'Token aktivasi tidak ditemukan.');

  const client = await pool.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(
      `select evt.user_id, evt.expires_at, u.email_verified_at
       from email_verification_tokens evt
       join users u on u.id=evt.user_id
       where evt.token_hash=$1
       for update`,
      [sha(token)],
    );
    const row = rows[0];
    if (!row) throw new HttpError(400, 'Link aktivasi tidak valid atau sudah digunakan.');
    if (row.email_verified_at) {
      await client.query('delete from email_verification_tokens where user_id=$1', [row.user_id]);
      await client.query('commit');
      return json({ ok: true, alreadyVerified: true });
    }
    if (new Date(row.expires_at).getTime() < Date.now()) throw new HttpError(400, 'Link aktivasi sudah kedaluwarsa. Kirim ulang email aktivasi.');

    await client.query('update users set email_verified_at=now() where id=$1', [row.user_id]);
    await client.query('delete from email_verification_tokens where user_id=$1', [row.user_id]);
    await client.query('commit');
    return json({ ok: true, verified: true });
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
});
