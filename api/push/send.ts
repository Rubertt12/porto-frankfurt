import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const env = (globalThis as any).process?.env || {};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const authorization = req.headers?.authorization;
  if (!authorization?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });

  const { condominium_id, title, body, url } = req.body || {};
  if (typeof condominium_id !== 'string' || typeof title !== 'string' || typeof body !== 'string') {
    return res.status(400).json({ error: 'Invalid notification payload' });
  }
  const targetUrl = typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? url : '/';

  const supabaseUrl = env.VITE_SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey || !env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    return res.status(503).json({ error: 'Push service is not configured' });
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });

  const token = authorization.slice('Bearer '.length);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return res.status(401).json({ error: 'Invalid session' });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', authData.user.id).maybeSingle();
  const isPlatformAdmin = profile?.role === 'super_admin';
  const { data: membership, error: membershipError } = await supabase
    .from('condominium_members')
    .select('role')
    .eq('condominium_id', condominium_id)
    .eq('profile_id', authData.user.id)
    .eq('is_active', true)
    .in('role', ['syndic', 'administrator', 'super_admin'])
    .maybeSingle();

  if (!isPlatformAdmin && (membershipError || !membership)) {
    return res.status(403).json({ error: 'Only condominium administrators can send push notifications' });
  }

  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from('push_subscriptions')
    .select('endpoint, subscription')
    .eq('condominium_id', condominium_id);

  if (subscriptionsError) return res.status(403).json({ error: 'Could not access push subscriptions' });

  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  const results = await Promise.all((subscriptions || []).map(async (row: any) => {
    try {
      await webpush.sendNotification(row.subscription, JSON.stringify({
        title: title.slice(0, 100),
        body: body.slice(0, 240),
        url: targetUrl,
        tag: 'condominium-' + condominium_id
      }));
      return true;
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('condominium_id', condominium_id).eq('endpoint', row.endpoint);
      }
      return false;
    }
  }));

  return res.status(200).json({
    sent: results.filter(Boolean).length,
    failed: results.filter(value => !value).length,
    total: results.length
  });
}
