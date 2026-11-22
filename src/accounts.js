
'use strict';

const crypto = require('node:crypto');

function normalizePhoneNumber(value) {
  if (typeof value !== 'string') {
    throw new Error('Invalid international phone number.');
  }

  const input = value.trim();

  if (!/^\+?[0-9\s().-]+$/.test(input)) {
    throw new Error('Invalid international phone number.');
  }

  const phoneNumber = input.replace(/\D/g, '');

  if (
    phoneNumber.length < 8 ||
    phoneNumber.length > 15 ||
    phoneNumber.startsWith('0')
  ) {
    throw new Error('Invalid international phone number.');
  }

  return phoneNumber;
}

function createAccountService(supabase) {
  if (!supabase) {
    throw new Error('Supabase client is required.');
  }

    async function registerPendingAccount(phoneInput, authUserId) {
    if (
      typeof authUserId !== 'string' ||
      authUserId.trim() === ''
    ) {
      throw new Error('Authenticated user is required.');
    }

    const phoneNumber = normalizePhoneNumber(phoneInput);
    const { data, error } = await supabase
      .schema('nexabot')
      .from('accounts')
      .insert({
        auth_user_id: authUserId,
        phone_e164: phoneNumber,
        account_status: 'pairing_pending'
      })
      .select('id, phone_e164, account_status, created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return {
          success: false,
          error: 'ACCOUNT_ALREADY_EXISTS'
        };
      }

      throw new Error('Account registration failed.');
    }

    return {
      success: true,
      account: {
        id: data.id,
        phoneNumber: data.phone_e164,
        status: data.account_status,
        createdAt: data.created_at
      }
    };
  }

  return { registerPendingAccount };
}

module.exports = {
  normalizePhoneNumber,
  createAccountService
};
