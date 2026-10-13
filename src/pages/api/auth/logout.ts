import type { APIRoute } from 'astro';
import { checkOrigin, destroySession, handle, json } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = handle(async (ctx) => {
  checkOrigin(ctx);
  await destroySession(ctx);
  return json({ ok: true });
});
