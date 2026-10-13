import type { APIRoute } from 'astro';
import { pool } from '../../../lib/db';
import { body, handle, hashPassword, HttpError, json, requireUser } from '../../../lib/auth';

export const prerender = false;

const ROLES = ['Admin', 'Staff', 'User'];

export const POST: APIRoute = handle(async (ctx) => {
  const admin = await requireUser(ctx, 'Admin');
  const b = await body(ctx);

  if (b.action === 'list') {
    const { rows } = await pool.query('select id,email,name,role,active from users order by created_at');
    return json({ users: rows });
  }

  if (b.action === 'create') {
    const email = String(b.email ?? '').trim().toLowerCase();
    const password = String(b.password ?? '');
    const role = b.role ?? 'Staff';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || password.length < 6 || !ROLES.includes(role)) throw new HttpError(400, 'Data tidak valid.');
    try {
      const { rows } = await pool.query(
        'insert into users (email,name,password_hash,role) values ($1,$2,$3,$4) returning id',
        [email, String(b.name ?? '').trim() || email.split('@')[0], await hashPassword(password), role],
      );
      return json({ ok: true, id: rows[0].id });
    } catch (e: any) {
      if (e?.code === '23505') throw new HttpError(409, 'Email sudah terdaftar.');
      throw e;
    }
  }

  const id = String(b.id ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, 'Invalid id');

  if (b.action === 'reset_password') {
    const password = String(b.password ?? '');
    if (password.length < 6) throw new HttpError(400, 'Password minimal 6 karakter.');
    await pool.query('update users set password_hash=$2 where id=$1', [id, await hashPassword(password)]);
    await pool.query('delete from sessions where user_id=$1', [id]);
    return json({ ok: true });
  }

  if (b.action === 'set_active') {
    if (id === admin.id) throw new HttpError(400, 'Tidak bisa menonaktifkan akun sendiri.');
    await pool.query('update users set active=$2 where id=$1', [id, !!b.active]);
    if (!b.active) await pool.query('delete from sessions where user_id=$1', [id]);
    return json({ ok: true });
  }

  if (b.action === 'delete') {
    if (id === admin.id) throw new HttpError(400, 'Tidak bisa menghapus akun sendiri.');
    await pool.query('delete from users where id=$1', [id]);
    return json({ ok: true });
  }

  throw new HttpError(400, 'Unknown action');
});
