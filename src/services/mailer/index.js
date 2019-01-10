class MailerInitializationError extends Error {};
class MailerSendError extends Error {};

class Mailer {
  constructor (provider, providerOpts) {
    if (!provider) {
      this._provider = null;
    } else {
      try {
        const providerModule = require(`./${provider}`);
        providerModule.initialize(providerOpts);
        this._provider = providerModule;
      } catch (e) {
        throw new MailerInitializationError(`Cannot initialize '${provider}': ${e.message}`);
      }
    }
  }

  sendMail (opts) {
    if (this._provider) {
      return this._provider.sendMail(opts);
    }
    return Promise.resolve();
  }
}

let _Mailer;

/**
 * Get the previously set Mailer instance.
 */
function get () {
  if (!_Mailer) {
    throw new Error('No Mailer instance has been set!');
  }
  return _Mailer;
}

/**
 * Set Mailer instance during runtime.
 */
function set (mailer) {
  _Mailer = mailer;
}

module.exports = {
  Mailer,
  MailerInitializationError,
  MailerSendError,
  get,
  set,
};
