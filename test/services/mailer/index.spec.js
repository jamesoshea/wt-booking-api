/* eslint-env mocha */
/* eslint-disable standard/object-curly-even-spacing */
/* eslint-disable no-new */
const { assert } = require('chai');
const sinon = require('sinon');

const {
  Mailer,
  MailerInitializationError,
} = require('../../../src/services/mailer');

describe('services - mailer', function () {
  describe('constructor', () => {
    it('should not panic on null provider', () => {
      new Mailer(null, {});
      new Mailer(undefined);
      const mailer = new Mailer();
      assert.isNull(mailer._provider);
    });

    it('should panic for unknown provider', () => {
      assert.throws(() => {
        new Mailer('random-unknown-mailer');
      }, MailerInitializationError);
    });

    it('should properly load a provider module', () => {
      const mailer = new Mailer('dummy', { from: 'dummy@example.com' });
      assert.isDefined(mailer._provider);
    });
  });

  describe('sendMail', () => {
    it('should call provider\'s sendMail', () => {
      const mailer = new Mailer('dummy', { from: 'dummy@example.com' });
      sinon.spy(mailer._provider, 'sendMail');
      mailer.sendMail({ from: 'mailer@example.com' });
      assert.equal(mailer._provider.sendMail.callCount, 1);
      assert.equal(mailer._provider.sendMail.firstCall.args[0].from, 'mailer@example.com');
      mailer._provider.sendMail.restore();
    });
  });
});
