const { createClient } = require('@supabase/supabase-js');

module.exports = function criarCliente(token) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(token ? { accessToken: async () => token } : {})
  });
};
