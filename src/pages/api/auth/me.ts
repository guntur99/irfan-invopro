import type { APIRoute } from 'astro';
import { getUser, handle, json } from '../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = handle(async (ctx) => json({ user: await getUser(ctx) }));
