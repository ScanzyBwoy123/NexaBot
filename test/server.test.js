'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { validateConfiguration } = require('../src/server');

test('server requires at least one developer ID', () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerId = process.env.DEPLOYER_ID;

  try {
    process.env.DEVELOPER_IDS = '';
    process.env.DEPLOYER_ID = '233240000888';

    assert.throws(
      () => validateConfiguration(),
      /DEVELOPER_IDS must be configured/
    );
  } finally {
    if (previousDeveloperIds === undefined) {
      delete process.env.DEVELOPER_IDS;
    } else {
      process.env.DEVELOPER_IDS = previousDeveloperIds;
    }

    if (previousDeployerId === undefined) {
      delete process.env.DEPLOYER_ID;
    } else {
      process.env.DEPLOYER_ID = previousDeployerId;
    }
  }
});

test('server requires a deployer ID', () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerId = process.env.DEPLOYER_ID;

  try {
    process.env.DEVELOPER_IDS = '233241234567';
    process.env.DEPLOYER_ID = '';

    assert.throws(
      () => validateConfiguration(),
      /DEPLOYER_ID must be configured/
    );
  } finally {
    if (previousDeveloperIds === undefined) {
      delete process.env.DEVELOPER_IDS;
    } else {
      process.env.DEVELOPER_IDS = previousDeveloperIds;
    }

    if (previousDeployerId === undefined) {
      delete process.env.DEPLOYER_ID;
    } else {
      process.env.DEPLOYER_ID = previousDeployerId;
    }
  }
});

test('server accepts valid developer and deployer IDs', () => {
  const previousDeveloperIds = process.env.DEVELOPER_IDS;
  const previousDeployerId = process.env.DEPLOYER_ID;

  try {
    process.env.DEVELOPER_IDS = '233241234567,233241234568';
    process.env.DEPLOYER_ID = '233240000888';

    const config = validateConfiguration();

    assert.deepEqual(config.developerIds, [
      '233241234567',
      '233241234568'
    ]);

    assert.equal(config.deployerId, '233240000888');
  } finally {
    if (previousDeveloperIds === undefined) {
      delete process.env.DEVELOPER_IDS;
    } else {
      process.env.DEVELOPER_IDS = previousDeveloperIds;
    }

    if (previousDeployerId === undefined) {
      delete process.env.DEPLOYER_ID;
    } else {
      process.env.DEPLOYER_ID = previousDeployerId;
    }
  }
});
