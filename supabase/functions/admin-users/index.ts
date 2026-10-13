import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') || ''
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')
    const { data: profile } = await userClient.from('profiles').select('role,active').eq('id', user.id).single()
    if (!profile?.active || profile?.role !== 'Admin') throw new Error('Admin only')

    const admin = createClient(url, service)
    const body = await req.json()
    const action = body.action

    if (action === 'list') {
      const { data: authUsers, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
      if (error) throw error
      const { data: profiles } = await admin.from('profiles').select('*')
      const map = new Map((profiles || []).map((p:any)=>[p.id,p]))
      const users = authUsers.users.map((u:any)=>({ id:u.id, email:u.email, name:map.get(u.id)?.name || u.user_metadata?.name || u.email, role:map.get(u.id)?.role || 'User', active:map.get(u.id)?.active !== false }))
      return Response.json({ users }, { headers: cors })
    }

    if (action === 'create') {
      const { email, password, name, role='Staff' } = body
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } })
      if (error) throw error
      await admin.from('profiles').upsert({ id:data.user.id, email, name, role, active:true })
      return Response.json({ ok:true, id:data.user.id }, { headers: cors })
    }

    if (action === 'reset_password') {
      const { error } = await admin.auth.admin.updateUserById(body.id, { password: body.password })
      if (error) throw error
      return Response.json({ ok:true }, { headers: cors })
    }

    if (action === 'set_active') {
      const { error } = await admin.from('profiles').update({ active: !!body.active }).eq('id', body.id)
      if (error) throw error
      return Response.json({ ok:true }, { headers: cors })
    }

    if (action === 'delete') {
      const { error } = await admin.auth.admin.deleteUser(body.id)
      if (error) throw error
      return Response.json({ ok:true }, { headers: cors })
    }

    throw new Error('Unknown action')
  } catch (e) {
    return Response.json({ error: e?.message || 'Request failed' }, { status: 400, headers: cors })
  }
})
