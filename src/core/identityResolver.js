'use strict';

function createIdentityResolver(client) {
  if (!client || typeof client.getContactLidAndPhone !== 'function') {
    throw new Error('Invalid WhatsApp client: identity resolution is unavailable.');
  }

  async function resolve(userId) {
    if (typeof userId !== 'string' || !userId.trim()) {
      return null;
    }

    const requestedId = userId.trim().toLowerCase();

    try {
      const results = await client.getContactLidAndPhone([requestedId]);

      if (!Array.isArray(results) || results.length !== 1) {
        return null;
      }

      const result = results[0];

      if (
        !result ||
        typeof result.lid !== 'string' ||
        typeof result.pn !== 'string'
      ) {
        return null;
      }

      const lid = result.lid.trim().toLowerCase();
      const pn = result.pn.trim().toLowerCase();

      if (!lid || !pn) {
        return null;
      }

      // Only accept a mapping that matches the requested identity.
      if (requestedId !== lid && requestedId !== pn) {
        return null;
      }

      return { lid, pn };
    } catch {
      return null;
    }
  }

  return { resolve };
}

module.exports = { createIdentityResolver };
