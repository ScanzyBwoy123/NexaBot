'use strict';

function normalizeId(id) {
  const value = String(id ?? '').trim().toLowerCase();

  if (!value) return '';

  const match = value.match(/^([^@]+)@([a-z0-9.-]+)$/);

  if (match) {
    const identifier = match[1].replace(/\D/g, '');
    const server = match[2];

    if (server === 'c.us') {
      return identifier;
    }

    return identifier ? `${identifier}@${server}` : '';
  }

  return value.replace(/\D/g, '');
}

function createAuthorizer(options = {}) {
  const developerIds = new Set(
    (options.developerIds || [])
      .map(normalizeId)
      .filter(Boolean)
  );

  const deployerId = normalizeId(options.deployerId);

  function authorize(senderId) {
    const sender = normalizeId(senderId);

    const isDeveloper =
      Boolean(sender && developerIds.has(sender));

    const isDeployer =
      Boolean(sender && deployerId && sender === deployerId);

    let role = 'unauthorized';

    if (isDeveloper) {
      role = 'developer';
    } else if (isDeployer) {
      role = 'deployer';
    }

    return {
      allowed: role !== 'unauthorized',
      isDeveloper,
      isDeployer,
      role,
      sender
    };
  }

  return {
    authorize,
    normalizeId
  };
}

module.exports = {
  normalizeId,
  createAuthorizer
};
