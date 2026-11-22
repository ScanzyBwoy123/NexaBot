'use strict';

function createSupabaseAuth(supabase) {
  if (
    !supabase ||
    !supabase.auth ||
    typeof supabase.auth.getUser !== 'function'
  ) {
    throw new Error('Supabase Auth client is required.');
  }

  async function verifyAccessToken(accessToken) {
    if (
      typeof accessToken !== 'string' ||
      accessToken.trim() === ''
    ) {
      return null;
    }

    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error || !data?.user?.id) {
      return null;
    }

    return data.user;
  }

  return { verifyAccessToken };
}

module.exports = { createSupabaseAuth };
