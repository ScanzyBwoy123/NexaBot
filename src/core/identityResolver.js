'use strict';

function createIdentityResolver(client) {
  if (!client || typeof client.getContactLidAndPhone !== 'function') {
    throw new Error('Invalid WhatsApp client: identity resolution is unavailable.');
  }

  async function resolve(userId) {
    if (typeof userId !== 'string' || !userId.trim()) {
      return null;
    }

    try {
      const results = await client.getContactLidAndPhone([userId.trim()]);

      if (!Array.isArray(results) || results.length !== 1) {
        return null;
      }

      const result = results[0];

      if (
        !result ||
        typeof result.lid !== 'string' ||
        typeof result.pn !== 'string' ||
        !result.lid.trim() ||
        !result.pn.trim()
      ) {
        return null;
      }

      return {
        lid: result.lid.trim().toLowerCase(),
        pn: result.pn.trim().toLowerCase()
      };
    } catch {
      return null;
    }
  }

  return { resolve };
}

module.exports = { createIdentityResolver };
