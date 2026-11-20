'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeId,
  createAuthorizer
} = require('../src/core/authorization');

const authorizer = createAuthorizer({
  developerIds: ['233240000001@c.us'],
  deployerId: '233240000002@c.us'
});

test('developer receives full authorization', () => {
  const result = authorizer.authorize('233240000001');

  assert.equal(result.allowed, true);
  assert.equal(result.role, 'developer');
  assert.equal(result.isDeveloper, true);
});

test('deployer can access their own bot', () => {
  const result = authorizer.authorize('233240000002');

  assert.equal(result.allowed, true);
  assert.equal(result.role, 'deployer');
  assert.equal(result.isDeployer, true);
});

test('unauthorized users are rejected', () => {
  const result = authorizer.authorize('233240000003');

  assert.equal(result.allowed, false);
  assert.equal(result.role, 'unauthorized');
});

test('phone IDs normalize consistently', () => {
  assert.equal(
    normalizeId('233240000001@c.us'),
    '233240000001'
  );
});

test('LID identities retain their server suffix', () => {
  assert.equal(
    normalizeId('123456789@lid'),
    '123456789@lid'
  );
});

test('developer takes precedence if also configured as deployer', () => {
  const sharedAuthorizer = createAuthorizer({
    developerIds: ['233240000001'],
    deployerId: '233240000001'
  });

  const result = sharedAuthorizer.authorize('233240000001');

  assert.equal(result.role, 'developer');
  assert.equal(result.isDeveloper, true);
  assert.equal(result.isDeployer, true);
});

test('empty and invalid identities are rejected', () => {
  assert.equal(authorizer.authorize('').allowed, false);
  assert.equal(authorizer.authorize(null).allowed, false);
  assert.equal(authorizer.authorize('unknown').allowed, false);
});
