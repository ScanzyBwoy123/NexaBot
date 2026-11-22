'use strict';

const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
function createSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase server configuration is missing.');
  }

  return createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  },
  realtime: {
    transport: WebSocket
  }
});
}
async function verifySupabaseConnection(client) {
  const { error } = await client
    .schema('nexabot')
    .from('accounts')
    .select('id')
    .limit(1);

  if (error) {
    throw new Error(`Supabase connectivity check failed: ${error.message}`);
  }

  return true;
}
module.exports = { createSupabaseClient };
