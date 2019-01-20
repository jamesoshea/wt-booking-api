/* eslint-env mocha */
const { assert } = require('chai');

const {
  normalizeEmail,
  normalizePhone,
} = require('../../src/services/normalizers');

describe('services - normalizers', function () {
  describe('normalizeEmail', () => {
    it('should not fail on empty input', () => {
      normalizeEmail();
    });

    it('should trim', () => {
      assert.equal(normalizeEmail('  at@at.com   '), 'at@at.com');
    });

    it('should make it lowercase', () => {
      assert.equal(normalizeEmail('AT@at.com'), 'at@at.com');
    });
  });

  describe('normalizePhone', () => {
    it('should not fail on empty input', () => {
      normalizePhone();
    });

    it('should remove spaces', () => {
      assert.equal(normalizePhone('   777 456 789   '), '777456789');
    });

    it('should remove dashes', () => {
      assert.equal(normalizePhone('777-456-789'), '777456789');
    });

    it('should remove parentheses', () => {
      assert.equal(normalizePhone('(777)456-789'), '777456789');
    });

    it('should convert leading 00 to +', () => {
      assert.equal(normalizePhone('00420 777 456 789'), '+420777456789');
    });

    it('should do everything at once', () => {
      assert.equal(normalizePhone('00(420) 777-456789   '), '+420777456789');
    });
  });
});
