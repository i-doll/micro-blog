import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assignRegistrationRole } from './auth.js';

describe('assignRegistrationRole', () => {
  it('returns "user" for a normal email', () => {
    assert.equal(assignRegistrationRole('alice@example.com'), 'user');
  });

  it('returns "user" for the previously-hardcoded admin email', () => {
    assert.equal(assignRegistrationRole('five@faen.dev'), 'user');
  });

  it('returns "user" for admin-like email addresses', () => {
    const adminLikeEmails = [
      'admin@example.com',
      'root@example.com',
      'superuser@example.com',
      'admin@faen.dev',
      'administrator@blog.com',
    ];
    for (const email of adminLikeEmails) {
      assert.equal(
        assignRegistrationRole(email),
        'user',
        `Expected "user" for ${email}, got "${assignRegistrationRole(email)}"`,
      );
    }
  });

  it('returns "user" for empty string', () => {
    assert.equal(assignRegistrationRole(''), 'user');
  });

  it('returns "user" for email with role-like substrings', () => {
    assert.equal(assignRegistrationRole('admin@admin.admin'), 'user');
    assert.equal(assignRegistrationRole('role=admin@evil.com'), 'user');
  });

  it('never returns "admin"', () => {
    // Fuzz with a range of plausible escalation attempts
    const attempts = [
      'five@faen.dev',
      'FIVE@FAEN.DEV',
      'Five@Faen.Dev',
      'admin@localhost',
      'root@localhost',
      '',
      'a'.repeat(500) + '@example.com',
      'user+admin@example.com',
      '"><script>@evil.com',
    ];
    for (const email of attempts) {
      const role = assignRegistrationRole(email);
      assert.notEqual(role, 'admin', `Email "${email}" must not receive admin role`);
      assert.equal(role, 'user', `Email "${email}" must receive "user" role`);
    }
  });
});
