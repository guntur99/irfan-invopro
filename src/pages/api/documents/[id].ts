import type { APIRoute } from 'astro';
import { pool } from '../../../lib/db';
import { body, handle, HttpError, json, requireUser } from '../../../lib/auth';

export const prerender = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idOf = (p: string | undefined) => {
  if (!p || !UUID.test(p)) throw new HttpError(400, 'Invalid id');
  return p;
};

export const PUT: APIRoute = handle(async (ctx) => {
  const user = await requireUser(ctx);
  const id = idOf(ctx.params.id);
  const d = await body(ctx);
  if (!d || typeof d !== 'object' || d.id !== id) throw new HttpError(400, 'Invalid document');
  try {
    const { rowCount } = await pool.query(
      `insert into documents (id,user_id,doc_type,doc_number,status,data) values ($1,$2,$3,$4,$5,$6)
       on conflict (id) do update set doc_type=excluded.doc_type, doc_number=excluded.doc_number,
         status=excluded.status, data=excluded.data, updated_at=now()
       where documents.user_id=excluded.user_id`,
      [id, user.id, String(d.type ?? ''), String(d.number ?? ''), String(d.status ?? 'Draft'), d],
    );
    if (!rowCount) throw new HttpError(403, 'Forbidden');
  } catch (e: any) {
    if (e?.code === '23505') throw new HttpError(409, 'Nomor dokumen sudah dipakai.');
    throw e;
  }
  return json({ ok: true });
});

export const DELETE: APIRoute = handle(async (ctx) => {
  const user = await requireUser(ctx);
  await pool.query('delete from documents where id=$1 and user_id=$2', [idOf(ctx.params.id), user.id]);
  return json({ ok: true });
});
