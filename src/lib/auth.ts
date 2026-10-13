import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { APIContext } from 'astro';
import { pool } from './db';

const COOKIE = 'invopro_session';
const SESSION_DAYS = 14;

export type User = { id: string; email: string; name: string; role: 'Admin' | 'Staff' | 'User'; active: boolean };

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const scryptAsync = (pw: string, salt: Buffer) =>
  new Promise<Buffer>((res, rej) => scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? rej(e) : res(k))));

export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const key = await scryptAsync(pw, salt);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(pw: string, stored: string) {
  const [alg, s, k] = stored.split('$');
  if (alg !== 'scrypt' || !s || !k) return false;
  const expected = Buffer.from(k, 'base64');
  const key = await scryptAsync(pw, Buffer.from(s, 'base64'));
  return key.length === expected.length && timingSafeEqual(key, expected);
}

const sha = (t: string) => createHash('sha256').update(t).digest('hex');

export async function createSession(ctx: APIContext, userId: string) {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await pool.query('insert into sessions (token_hash,user_id,expires_at) values ($1,$2,$3)', [sha(token), userId, expires]);
  ctx.cookies.set(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: import.meta.env.PROD, path: '/', expires,
  });
}

export async function destroySession(ctx: APIContext) {
  const token = ctx.cookies.get(COOKIE)?.value;
  if (token) await pool.query('delete from sessions where token_hash=$1', [sha(token)]);
  ctx.cookies.delete(COOKIE, { path: '/' });
}

export async function getUser(ctx: APIContext): Promise<User | null> {
  const token = ctx.cookies.get(COOKIE)?.value;
  if (!token) return null;
  const { rows } = await pool.query(
    `select u.id,u.email,u.name,u.role,u.active from sessions s join users u on u.id=s.user_id
     where s.token_hash=$1 and s.expires_at>now() and u.active`,
    [sha(token)],
  );
  return rows[0] ?? null;
}

// Tolak request tulis dari origin lain (CSRF), lalu wajib login.
export async function requireUser(ctx: APIContext, role?: 'Admin'): Promise<User> {
  if (!['GET', 'HEAD'].includes(ctx.request.method)) {
    const origin = ctx.request.headers.get('origin');
    if (origin && new URL(origin).host !== ctx.request.headers.get('host')) throw new HttpError(403, 'Forbidden');
  }
  const user = await getUser(ctx);
  if (!user) throw new HttpError(401, 'Unauthorized');
  if (role && user.role !== role) throw new HttpError(403, 'Admin only');
  return user;
}

export function checkOrigin(ctx: APIContext) {
  const origin = ctx.request.headers.get('origin');
  if (origin && new URL(origin).host !== ctx.request.headers.get('host')) throw new HttpError(403, 'Forbidden');
}

// Pembatas percobaan login sederhana (in-memory, per instance).
const attempts = new Map<string, { n: number; reset: number }>();
export function rateLimit(key: string, max = 8, windowMs = 10 * 60_000) {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || a.reset < now) { attempts.set(key, { n: 1, reset: now + windowMs }); return; }
  if (++a.n > max) throw new HttpError(429, 'Terlalu banyak percobaan, coba lagi nanti.');
}

export const handle = (fn: (ctx: APIContext) => Promise<Response>) => async (ctx: APIContext) => {
  try {
    return await fn(ctx);
  } catch (e: any) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: 'Server error' }, 500);
  }
};

export async function body(ctx: APIContext) {
  try { return await ctx.request.json(); } catch { throw new HttpError(400, 'Invalid JSON'); }
}
