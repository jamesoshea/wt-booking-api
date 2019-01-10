const sendgridApi = require('@sendgrid/mail');
const { MailerSendError } = require('./index');

class SendgridMailerError extends Error {};

let _opts;
const initialize = (opts) => {
  _opts = opts;
  if (!opts.apiKey) {
    throw new SendgridMailerError('Missing apiKey in opts');
  }
  if (!opts.from) {
    throw new SendgridMailerError('Missing from in opts');
  }
  sendgridApi.setApiKey(opts.apiKey);
};

const sendMail = (params) => {
  const required = ['to', 'subject', 'text', 'html'];
  for (let i = 0; i < required.length; i++) {
    if (!params[required[i]]) {
      throw new MailerSendError(`Missing '${required[i]}'`);
    }
  }
  return sendgridApi.send({
    from: params.from || _opts.from,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
  });
};

module.exports = {
  initialize,
  sendMail,
  _sendgridApi: sendgridApi,
};
