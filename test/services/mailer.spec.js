/* eslint-env mocha */
/* eslint-disable standard/object-curly-even-spacing */
/* eslint-disable no-new */
const { assert } = require('chai');
const sinon = require('sinon');

const {
  Mailer,
  MailerInitializationError,
  MailerSendError,
} = require('../../src/services/mailer');

describe('services - mailer', function () {
  describe('adapter', () => {
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

      it('should properly load a dummy provider module', () => {
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

  describe('sendgrid', () => {
    let mailer, mail;

    beforeEach(() => {
      mailer = new Mailer('sendgrid', { apiKey: '1234', from: 'defaults@example.com' });
      mail = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'SG subject',
        text: 'SG text',
        html: '<p>SG text</p>',
      };
      sinon.stub(mailer._provider._sendgridApi, 'send');
    });

    afterEach(() => {
      mailer._provider._sendgridApi.send.restore && mailer._provider._sendgridApi.send.restore();
    });

    it('should throw when apiKey is missing', () => {
      assert.throws(() => {
        new Mailer('sendgrid', { from: 'dummy@example.com' });
      }, MailerInitializationError);
    });

    it('should throw when from is missing', () => {
      assert.throws(() => {
        new Mailer('sendgrid', { apiKey: 'dummy@example.com' });
      }, MailerInitializationError);
    });

    it('should initialize sendgrid', () => {
      assert.isDefined(mailer._provider._sendgridApi);
    });

    it('should send e-mail with sendgrid', () => {
      mailer.sendMail(mail);
      assert.equal(mailer._provider._sendgridApi.send.callCount, 1);
      assert.equal(mailer._provider._sendgridApi.send.firstCall.args[0].from, 'sender@example.com');
      assert.equal(mailer._provider._sendgridApi.send.firstCall.args[0].to, 'recipient@example.com');
      assert.equal(mailer._provider._sendgridApi.send.firstCall.args[0].subject, 'SG subject');
      assert.equal(mailer._provider._sendgridApi.send.firstCall.args[0].text, 'SG text');
      assert.equal(mailer._provider._sendgridApi.send.firstCall.args[0].html, '<p>SG text</p>');
    });

    it('should fallback to sender from _opts', () => {
      delete mail.from;
      mailer.sendMail(mail);
      assert.equal(mailer._provider._sendgridApi.send.callCount, 1);
      assert.equal(mailer._provider._sendgridApi.send.firstCall.args[0].from, 'defaults@example.com');
      assert.equal(mailer._provider._sendgridApi.send.firstCall.args[0].to, 'recipient@example.com');
      assert.equal(mailer._provider._sendgridApi.send.firstCall.args[0].subject, 'SG subject');
      assert.equal(mailer._provider._sendgridApi.send.firstCall.args[0].text, 'SG text');
      assert.equal(mailer._provider._sendgridApi.send.firstCall.args[0].html, '<p>SG text</p>');
      mailer._provider._sendgridApi.send.restore();
    });

    it('should throw when to is missing', () => {
      assert.throws(() => {
        delete mail.to;
        mailer.sendMail(mail);
      }, MailerSendError);
    });

    it('should throw when subject is missing', () => {
      assert.throws(() => {
        delete mail.subject;
        mailer.sendMail(mail);
      }, MailerSendError);
    });
  });
});
