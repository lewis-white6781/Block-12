import { describe, expect, it } from 'vitest';
import { syncErrorMessage } from '../syncEngine';

// Regression coverage for the bug that made every sync failure display as the
// generic "Sync failed." with no way to diagnose it from the device: Supabase
// throws a PostgrestError, which is a plain object, not a JS Error, so
// `err instanceof Error` was false for exactly the errors this most needs to
// surface (RLS denial, missing table, bad column).
describe('syncErrorMessage', () => {
  it('reads .message off a real Error', () => {
    expect(syncErrorMessage(new Error('network blip'))).toBe('network blip');
  });

  it('reads .message off a PostgrestError-shaped plain object, and appends the code', () => {
    const postgrestError = {
      message: 'permission denied for table block_state',
      details: null,
      hint: null,
      code: '42501',
    };
    expect(syncErrorMessage(postgrestError)).toBe('permission denied for table block_state (42501)');
  });

  it('omits the parenthetical when there is no code', () => {
    expect(syncErrorMessage({ message: 'relation "block_state" does not exist' })).toBe(
      'relation "block_state" does not exist',
    );
  });

  it('falls back to a generic message for anything else', () => {
    expect(syncErrorMessage('a bare string')).toBe('Sync failed.');
    expect(syncErrorMessage(null)).toBe('Sync failed.');
    expect(syncErrorMessage(undefined)).toBe('Sync failed.');
    expect(syncErrorMessage({ code: '42501' })).toBe('Sync failed.'); // no message field
    expect(syncErrorMessage({ message: 123 })).toBe('Sync failed.'); // wrong type
  });
});
